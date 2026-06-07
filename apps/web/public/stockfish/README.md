# Stockfish (client-side engine)

Single-threaded Stockfish compiled to WebAssembly (with an asm.js fallback),
served as static assets and run in a Web Worker by
`apps/web/src/lib/engine/stockfish-client.ts`.

Vs-computer games are **unrated**, so the engine runs entirely in the player's
browser — the server only validates and records moves. This keeps zero chess
compute on the API box.

## Files

- `stockfish.wasm.js` — wasm worker loader (preferred; loads `stockfish.wasm`)
- `stockfish.wasm` — engine wasm binary
- `stockfish.js` — asm.js fallback worker (for browsers without WebAssembly)
- `Copying.txt` — GPLv3 license (Stockfish)

## Source

[`stockfish.js@10.0.2`](https://www.npmjs.com/package/stockfish.js)
(niklasf build — single-threaded, 32 MB memory cap, classic-worker friendly).

To update:

```bash
cd /tmp && npm pack stockfish.js@<version> && tar -xzf stockfish.js-*.tgz
cp package/stockfish.js package/stockfish.wasm package/stockfish.wasm.js package/Copying.txt \
   <repo>/apps/web/public/stockfish/
```

## Why single-threaded

The threaded build needs `SharedArrayBuffer`, which requires COEP
`require-corp` + COOP `same-origin` headers — those can break cross-origin
embeds (analytics, error tracking, OG images). At the Skill Levels we cap to
for difficulty 1–8, single-threaded is already far stronger than any human
opponent, so threading adds no perceptible playing strength. If deeper analysis
is ever needed, swap in a threaded build and add the headers in `next.config.js`.
