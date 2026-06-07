#!/usr/bin/env python3
"""Validate the Purchess MVP epic DAG.

Reads all session files in a directory, parses YAML frontmatter (depends_on,
parallel_safe, touches), builds the dependency graph, computes Kahn-style waves,
and reports:
  - Sessions per wave
  - Any missing dependencies
  - Any sessions with overlapping touches in the same wave (--strict mode)
  - Total session count

Usage:
  python3 scripts/validate-dag.py <session-dir> [--strict] [--json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict, deque
from pathlib import Path
from typing import Any


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def parse_frontmatter(text: str) -> dict[str, Any]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    fm: dict[str, Any] = {}
    current_list_key: str | None = None
    for raw_line in match.group(1).splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        if line.startswith("  - ") and current_list_key is not None:
            value = line[4:].strip().strip('"').strip("'")
            fm[current_list_key].append(value)
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if value == "":
                fm[key] = []
                current_list_key = key
                continue
            current_list_key = None
            # Handle inline list: [a, b, c]
            if value.startswith("[") and value.endswith("]"):
                inner = value[1:-1].strip()
                if not inner:
                    fm[key] = []
                else:
                    items = [v.strip().strip('"').strip("'") for v in inner.split(",")]
                    fm[key] = [v for v in items if v]
                continue
            value = value.strip('"').strip("'")
            if value.lower() in ("true", "false"):
                fm[key] = value.lower() == "true"
            else:
                fm[key] = value
    if "depends_on" not in fm:
        fm["depends_on"] = []
    if "touches" not in fm:
        fm["touches"] = []
    if "parallel_safe" not in fm:
        fm["parallel_safe"] = True
    return fm


def session_number(path: Path) -> int:
    match = re.match(r"session-(\d+)", path.stem)
    if not match:
        raise ValueError(f"Bad session filename: {path.name}")
    return int(match.group(1))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("session_dir", type=Path)
    parser.add_argument("--strict", action="store_true",
                        help="Fail if parallel siblings in the same wave have overlapping touches.")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if not args.session_dir.is_dir():
        print(f"error: {args.session_dir} is not a directory", file=sys.stderr)
        return 1

    sessions: dict[int, dict[str, Any]] = {}
    for path in sorted(args.session_dir.glob("session-*.md")):
        n = session_number(path)
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        sessions[n] = {"path": path, "frontmatter": fm, "title": path.stem}

    if not sessions:
        print(f"error: no session files in {args.session_dir}", file=sys.stderr)
        return 1

    # Validate depends_on references
    all_ids = set(sessions.keys())
    errors: list[str] = []
    for n, s in sessions.items():
        for dep in s["frontmatter"]["depends_on"]:
            try:
                dep_id = int(dep)
            except (TypeError, ValueError):
                errors.append(f"session-{n:02d} has non-integer depends_on: {dep!r}")
                continue
            if dep_id not in all_ids:
                errors.append(f"session-{n:02d} depends on missing session-{dep_id:02d}")

    # Topological sort using Kahn's algorithm with deterministic wave assignment.
    # If a session's depends_on is empty, it goes in wave 1.
    in_degree: dict[int, int] = {n: 0 for n in all_ids}
    dependents: dict[int, list[int]] = defaultdict(list)
    for n, s in sessions.items():
        for dep in s["frontmatter"]["depends_on"]:
            try:
                dep_id = int(dep)
            except (TypeError, ValueError):
                continue
            in_degree[n] += 1
            dependents[dep_id].append(n)

    # Wave assignment: each session's wave = 1 + max(wave of its dependencies).
    wave_of: dict[int, int] = {}
    remaining = dict(in_degree)
    queue: deque[int] = deque()
    for n, deg in remaining.items():
        if deg == 0:
            queue.append(n)

    waves: dict[int, list[int]] = defaultdict(list)
    wave_counter = 0
    while queue:
        wave_counter += 1
        wave_size = len(queue)
        current: list[int] = []
        for _ in range(wave_size):
            n = queue.popleft()
            wave_of[n] = wave_counter
            waves[wave_counter].append(n)
            current.append(n)
            for dep in dependents[n]:
                remaining[dep] -= 1
                if remaining[dep] == 0:
                    queue.append(dep)
        for n in current:
            pass

    if len(wave_of) != len(all_ids):
        unresolved = sorted(set(all_ids) - set(wave_of.keys()))
        errors.append(f"cycle detected involving: {unresolved}")

    # Strict-mode touch overlap detection
    overlaps: list[tuple[int, int, str]] = []
    if args.strict and not errors:
        for w, ids in waves.items():
            id_list = sorted(ids)
            for i, a in enumerate(id_list):
                for b in id_list[i + 1:]:
                    sa = set(sessions[a]["frontmatter"]["touches"])
                    sb = set(sessions[b]["frontmatter"]["touches"])
                    shared = sa & sb
                    for path in shared:
                        overlaps.append((a, b, path))

    output: dict[str, Any] = {
        "session_count": len(sessions),
        "wave_count": wave_counter,
        "waves": {str(w): sorted(sessions_in_wave) for w, sessions_in_wave in waves.items()},
        "sessions": {
            str(n): {
                "path": str(s["path"].relative_to(args.session_dir)),
                "depends_on": s["frontmatter"]["depends_on"],
                "parallel_safe": s["frontmatter"]["parallel_safe"],
                "touches": s["frontmatter"]["touches"],
                "wave": wave_of.get(n),
            } for n, s in sessions.items()
        },
        "errors": errors,
        "overlaps": [{"session_a": a, "session_b": b, "path": p} for a, b, p in overlaps],
    }

    if args.json:
        print(json.dumps(output, indent=2))
    else:
        print(f"Sessions: {len(sessions)}")
        print(f"Waves:    {wave_counter}")
        print()
        for w in sorted(waves.keys()):
            ids = sorted(waves[w])
            n_safe = sum(1 for i in ids if sessions[i]["frontmatter"]["parallel_safe"])
            marker = " (parallel)" if n_safe > 1 else " (sequential)"
            print(f"Wave {w}{marker}:")
            for i in ids:
                fm = sessions[i]["frontmatter"]
                deps = ", ".join(f"session-{int(d):02d}" for d in fm["depends_on"]) or "(none)"
                print(f"  - session-{i:02d}  depends_on: {deps}  touches: {len(fm['touches'])} paths")
        if errors:
            print()
            print("ERRORS:")
            for e in errors:
                print(f"  - {e}")
        if overlaps:
            print()
            print("OVERLAPPING TOUCHES (strict mode):")
            for a, b, p in overlaps:
                print(f"  - session-{a:02d} and session-{b:02d} both touch: {p}")

    return 0 if not errors and not overlaps else 2


if __name__ == "__main__":
    sys.exit(main())
