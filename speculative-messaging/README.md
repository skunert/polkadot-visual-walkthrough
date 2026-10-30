# Speculative messaging on JAM: animated walkthrough

An interactive, step-by-step animation of speculative messaging over the
Parachain Service, following the inclusion tier. Written for readers who know
polkadot-sdk but are new to the messaging design.

It is one pass through a full round trip: channel setup (told compactly), then
A's first data block in detail on its way to B (commit, settlement on JAM,
fetch and verify, consumption, the settlement check of B's block), and finally
the credit flowing back to A.

It complements the Parachain Service on JAM and speculative messaging design
documents.

## Run

From the repository root:

```bash
npm install
npm run dev        # http://localhost:5173/speculative-messaging/
```

Keys: → / Space plays the next beat (busy steps are split into beats, one per
bullet in the panel), ← goes back one beat, R replays the current beat. The
panel's buttons jump between chapters; `#<n>` in the URL opens step n.

## Layout

- `index.html`: the SVG scene, every animated element has an `id`.
- `src/steps.js`: panel narration per step.
- `src/main.js`: one builder per step, all on a single GSAP timeline. Whatever
  a step shows stays on screen when it ends; builders return their transient
  elements, which the next step clears. Builders use only `set`/`to` on elements that are
  animated more than once, so seeking backwards stays exact.
- `scripts/shoot.mjs`: screenshots of every step's end state and a few
  mid-animation frames (Playwright),
  `node speculative-messaging/scripts/shoot.mjs <url> <outdir>`.
- `scripts/mid-check.mjs`: samples the channel-opening token's path for jumps.

The deck checks in the root `scripts/` apply to this walkthrough.
