'use client';

import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import type {
  RepertoireColorDto,
  RepertoireDto,
  RepertoireNodeDto,
} from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parsePgnToTree, STARTING_FEN } from '@/lib/board/pgn-parser';
import type { AnalysisNode } from '@/lib/board/analysis-tree';
import { importRepertoire, createRepertoire } from '@/lib/api/repertoire';
import { cn } from '@/lib/utils';
import { RepertoireExplorerBuilder } from './repertoire-explorer-builder';

/** Total move nodes in the subtree (excluding the root). */
function countNodes(node: AnalysisNode): number {
  let n = 0;
  const stack: AnalysisNode[] = [node];
  while (stack.length) {
    const cur = stack.pop() as AnalysisNode;
    for (const c of cur.children) {
      n += 1;
      stack.push(c);
    }
  }
  return n;
}

/** Number of leaf lines (root→leaf paths). A bare root counts as 0. */
export function countLines(node: AnalysisNode): number {
  if (node.children.length === 0) return 0;
  let n = 0;
  const stack: AnalysisNode[] = [...node.children];
  while (stack.length) {
    const cur = stack.pop() as AnalysisNode;
    if (cur.children.length === 0) n += 1;
    else for (const c of cur.children) stack.push(c);
  }
  return n;
}

type Mode = 'choose' | 'pgn' | 'explorer';

export interface RepertoireImportProps {
  /** Called with the newly-created repertoire after a successful save. */
  onSaved: (created: RepertoireDto) => void;
  onCancel: () => void;
}

/**
 * Build or import a repertoire. Two sources:
 *  - Paste PGN: parsed CLIENT-SIDE into the existing `AnalysisNode` tree
 *    (variations/comments/NAGs preserved); the pre-built tree is posted and the
 *    server re-validates legality + caps node count.
 *  - Build from the opening explorer: start position, click explorer rows to
 *    grow the tree, then save.
 */
export function RepertoireImport({ onSaved, onCancel }: RepertoireImportProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [color, setColor] = useState<RepertoireColorDto>('white');
  const [pgn, setPgn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Parse the pasted PGN on every change — drives the live line-count preview.
  const parsed = useMemo<AnalysisNode | null>(() => {
    const text = pgn.trim();
    if (!text) return null;
    try {
      const { root } = parsePgnToTree(text, Chess);
      if (root.children.length === 0) return null;
      return root;
    } catch {
      return null;
    }
  }, [pgn]);

  const lineCount = parsed ? countLines(parsed) : 0;
  const nodeCount = parsed ? countNodes(parsed) : 0;

  async function savePgn() {
    if (!name.trim()) {
      setError('Give your repertoire a name.');
      return;
    }
    if (!parsed) {
      setError('Paste a PGN with at least one move.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await importRepertoire({
        name: name.trim(),
        color,
        tree: parsed as RepertoireNodeDto,
      });
      onSaved(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setSaving(false);
    }
  }

  async function saveExplorerTree(tree: AnalysisNode) {
    if (!name.trim()) {
      setError('Give your repertoire a name.');
      return;
    }
    if (tree.children.length === 0) {
      setError('Add at least one move before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createRepertoire({
        name: name.trim(),
        color,
        tree: tree as RepertoireNodeDto,
      });
      onSaved(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const meta = (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="rep-name" className="text-xs text-muted-foreground">
          Name
        </Label>
        <Input
          id="rep-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. My Italian, White"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <span className="block text-xs text-muted-foreground">Color</span>
        <div className="flex gap-1.5" role="group" aria-label="Repertoire color">
          {(['white', 'black'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={color === c}
              className={cn(
                'h-10 rounded-[7px] border px-4 text-sm font-medium capitalize transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50',
                color === c
                  ? 'border-brass/70 bg-brass/15 text-brass'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (mode === 'choose') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-foreground">New repertoire</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('pgn')}
            className="rounded-[10px] border border-border bg-surface/60 p-5 text-left transition-colors hover:border-brass/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50"
          >
            <BookOpen className="mb-2 h-5 w-5 text-brass" aria-hidden="true" />
            <p className="font-medium text-foreground">Paste a PGN</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Import a line (or a full variation tree) from any PGN.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode('explorer')}
            className="rounded-[10px] border border-border bg-surface/60 p-5 text-left transition-colors hover:border-brass/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50"
          >
            <BookOpen className="mb-2 h-5 w-5 text-brass" aria-hidden="true" />
            <p className="font-medium text-foreground">Build from the explorer</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start from the opening and click the lines you play.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'explorer') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {meta}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <RepertoireExplorerBuilder
          color={color}
          startFen={STARTING_FEN}
          saving={saving}
          onSave={saveExplorerTree}
        />
      </div>
    );
  }

  // mode === 'pgn'
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMode('choose')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {meta}
      <div className="space-y-1.5">
        <Label htmlFor="rep-pgn" className="text-xs text-muted-foreground">
          PGN
        </Label>
        <textarea
          id="rep-pgn"
          rows={8}
          spellCheck={false}
          autoComplete="off"
          value={pgn}
          onChange={(e) => {
            setPgn(e.target.value);
            if (error) setError(null);
          }}
          placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 (3. Bc4 Bc5) a6 …'}
          className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed placeholder:text-muted-foreground focus-visible:border-brass/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {parsed
            ? `${lineCount} line${lineCount === 1 ? '' : 's'} · ${nodeCount} move${nodeCount === 1 ? '' : 's'}`
            : 'Paste a PGN to see its lines.'}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={savePgn} disabled={saving || !parsed} className="w-full">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Importing…
          </>
        ) : (
          'Import repertoire'
        )}
      </Button>
    </div>
  );
}
