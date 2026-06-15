# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## What This Is

macOS CLI tool that records microphone audio via ffmpeg and transcribes it locally using whisperkit-cli. Pure Node.js ESM with TypeScript (via Node's native type stripping), single dependency (`openai` SDK).

## Commands

```bash
npm test                               # run all tests
npm run typecheck                      # type-check without emitting
node --test test/server-check.test.ts  # run a single test file
node bin/mictotext.ts                  # run the CLI
```

No build step, no bundler — Node runs `.ts` files directly via native type stripping.

## Architecture

`bin/mictotext.ts` → `src/cli.ts` orchestrates the pipeline:

1. **server-check.ts** — `GET /health` on whisperkit-cli (localhost, port from `config.ts`)
2. **recorder.ts** — spawns `ffmpeg -f avfoundation` to record mic to a temp WAV (16kHz mono PCM)
3. **transcriber.ts** — sends WAV to whisperkit-cli's OpenAI-compatible `/v1` endpoint via `openai` SDK
4. **config.ts** — shared `DEFAULT_PORT` and `DEFAULT_BASE_URL`

## Key Patterns

- **SIGINT two-phase:** 1st Ctrl-C aborts recording via AbortController, 2nd exits immediately. Raw mode stdin intercepts Ctrl-C as keypress (not SIGINT) to avoid killing piped processes.
- **ffmpeg detached:** spawned with `detached: true`; we send `SIGINT` ourselves so ffmpeg finalizes the WAV header. Exit codes 0, 255, and null are all acceptable.
- **Duration fallback:** ffprobe for accuracy, file-size math (`(size - 44) / 32000`) if ffprobe fails on truncated WAV.
- **whisperkit-cli binds IPv6 only** — always use `localhost`, never `127.0.0.1`.
- **EPIPE handling:** `cli.ts` wraps stream writes in try/catch; falls back to stderr if stdout pipe breaks.
- **verbatimModuleSyntax:** type-only imports must use `import type` — Node's type stripping requires this.

## Testing

Uses `node:test` and `node:assert/strict`. Tests that need whisperkit-cli or ffmpeg use top-level `await` to check availability and `skip` if unavailable — this is required because `it({ skip })` evaluates at definition time, not runtime (so `before()` hooks won't work).

Test servers are created dynamically with `node:http` on port 0.
