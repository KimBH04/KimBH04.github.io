# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A personal blog (`KimBH04.github.io`) built as a plain HTML/CSS/JavaScript single-page app — no framework, no bundler, no npm. The site files live at the repo root (`index.html`, `css/`, `js/`, `Posts/`, `games.json`, `icon-192.png`); only those — listed in `SITE` in `serve.py` — are deployed. Posts are Markdown files rendered in the browser with [marked](https://marked.js.org/) (ES module from jsDelivr, pinned to `marked@18.0.14` in `js/posts.js`). There is no test suite.

## Commands

```bash
python3 serve.py              # dev server at http://localhost:5262 (--port to change)
python3 serve.py --build      # copy SITE files into _site/ + posts.json + 404.html (what CI does)
```

`serve.py` (stdlib only) mimics GitHub Pages: it generates `/posts.json` on every request and answers unknown paths with `index.html` and status 404, so reloading `/post/...` works. It also refuses to serve anything outside `SITE` (e.g. `serve.py`, `.git`). When adding a new top-level site file or folder, add it to `SITE`. Opening `index.html` via `file://` does not work (ES modules + `fetch`).

Deployment: pushing to `main` runs `.github/workflows/gh-pages.yml`, which runs `python3 serve.py --build` and uploads `_site/` as the Pages artifact. `_site/` (with the generated `posts.json` and `404.html`) is git-ignored — don't commit it, and don't switch Pages to "deploy from branch" (those files would be missing, and Jekyll would drop `_`-prefixed posts).

## Architecture

- **Shell**: `index.html` holds the static window chrome (title bar, header, section tabs, status bar) and an empty `<main id="main">`. All asset URLs are root-absolute (`/css/...`, `/js/...`) because the same file is served as `404.html` at deep paths.
- **Router** (`js/app.js`): a route table maps paths to page modules — `/` home, `/post/<slug>`, `/game`, `/art`, `/write`; unknown paths `replaceState` to `/`. Same-origin clicks on links that match a route are intercepted (`pushState`); everything else navigates normally. Each navigation renders into a fresh container, so a slow async page can't overwrite a newer one. After client-side navigation the page's `h1` gets focus. `app.js` also updates the title-bar path (percent-decoded), the active section tab (`section` in the route table), the status-bar post count and the clock.
- **Pages** (`js/pages/*.js`): each exports `render(root, ...params)`, sets `document.title`, and writes markup with template literals. Every interpolated value goes through `esc()` (`js/util.js`); only rendered post HTML is inserted raw. Post links use `postHref()` (`encodeURIComponent`, so slugs with `#`/`?` work).
- **Posts** (`js/posts.js`): `loadPosts()` fetches `/posts.json` (array of file names without `.md`), then every non-hidden `Posts/<slug>.md`, parses them and sorts newest-first (undated last). `getPost(slug)` falls back to fetching the file directly, which is how hidden posts load.
- **Hidden posts**: file name starts with `_` → `isHidden()` keeps it out of the list, tag counts, post count and prev/next, but `/post/_name` still works. Not secret — the file is deployed.
- **Post format**: slug = file name without `.md` (Korean, spaces, `#` are fine). Optional front matter, parsed by the small hand-written `parsePost()` (not YAML — keep to `key: value` lines):
  ```
  ---
  title: 글 제목          # defaults to the file name
  date: 2026-10-14 14:31  # local time; missing → shown as "—" and sorted last
  tags: [C#, blazor]
  ---
  ```
- **Adding a post**: drop the `.md` into `Posts/` — nothing to register (the index is generated).
- **Writing a post**: `/write` (`js/pages/write.js`, not linked in the nav) — editor with markdown toolbar and Ctrl+B/I/E/K shortcuts (`js/editor.js`), live preview, and a download of `<title>.md` (filename-illegal chars stripped) with front matter prepended. Drafts autosave to `localStorage` key `blog-write-draft` as `{ Title, Tags, Body }`.
- **Games tab**: `/game` lists `games.json` (`[{ "Title", "Url", "Description"? }]`, http(s) URLs only); shows nothing while loading. Links open in a new tab.
- **Arts tab**: `/art` — currently an empty page.

## Design system

Retro / neo-brutalist, but readability first: monospace type (D2Coding from jsDelivr `joungkyun/font-d2coding@1.3.2`, declared via our own `@font-face` as `"D2Coding Web"` at the top of `css/app.css` — the upstream `d2coding.css` doesn't apply its bold face; weights 400/700 only), square corners, 2px black borders, hard offset shadows, no decorative characters or mascots.

- Palette tokens live in `:root` of `css/app.css`: `--blue #0856FF` (links, active/primary), `--yellow #FFFF00` (hover/selection background only — never as text color), `--teal #2C6262` (page background, tags), `--white`. Use the tokens instead of raw hex.
- CSS files: `app.css` (font, tokens, base, shared `.btn`/`.tag`/`.markdown`), `layout.css` (window chrome), and one file per page. There is no CSS isolation: every page renders inside a root class (`.HomePage`, `.PostPage`, `.GamesPage`, `.WritePage`) and its stylesheet prefixes every selector with it, because short class names (`.Tabs`, `.Row`, `.Title`, `.Heading`…) repeat across pages. The window's tabs are `.SectionTabs`/`.SectionTab` to stay distinct from the home page's category `.Tabs`.
- Mobile breakpoint is `max-width: 640px`.
