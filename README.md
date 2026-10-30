# Polkadot visual walkthroughs

Interactive, step-by-step animations of Polkadot designs, published as a static
site on GitHub Pages.

| Walkthrough | Folder |
| --- | --- |
| Speculative messaging on JAM | [`speculative-messaging/`](speculative-messaging/) |

## Run

```bash
npm install
npm run dev        # http://localhost:5173, landing page at /, walkthroughs at /<folder>/
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
```

## Layout

- `index.html`: landing page, one card per walkthrough.
- `<walkthrough>/`: a self-contained walkthrough with its own `index.html`,
  `src/` and `README.md`.
- `shared/`: styles every page can import. `fonts.css` bundles Inter and
  JetBrains Mono, so text widths are the same for every viewer.
- `scripts/`: checks for any walkthrough that exposes the deck API (below).
- `vite.config.js`: builds the landing page and every top-level folder that has
  an `index.html`, with relative asset URLs.

## Adding a walkthrough

1. Create a top-level folder, e.g. `my-topic/`, with an `index.html` that
   references its assets with relative paths (`./src/main.js`).
2. Import `../../shared/fonts.css` from its stylesheet to use the shared fonts.
3. Add a card for it to the root `index.html` and a row to the table above.

The build picks up the folder automatically; no config change is needed.

## Checks

Walkthroughs built on a single GSAP timeline can expose
`window.__deck = { go, show, beatCount, steps, tl, starts, ends }` (see
`speculative-messaging/src/main.js`). Then, with the site running:

```bash
node scripts/check.mjs <url>        # step and beat counts, bullets per beat, page errors
node scripts/check-diff.mjs <url>   # playing forward and seeking backward give the same scene
```

The scripts use Playwright; set `CHROMIUM_PATH` to use a system Chromium.

## Publishing

`.github/workflows/pages.yml` builds the site and deploys `dist/` to GitHub
Pages on every push to `main`. In the repository settings, under
Pages → Build and deployment, set the source to "GitHub Actions".
