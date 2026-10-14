# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A personal blog built as a **Blazor WebAssembly** (.NET 10) static site, deployed to GitHub Pages (`KimBH04.github.io`). Posts are Markdown files rendered client-side with Markdig. There is no backend and no test project.

## Commands

```bash
dotnet run          # local dev server (URLs in Properties/launchSettings.json)
dotnet watch        # dev server with hot reload
dotnet build
dotnet publish -c Release   # output in bin/Release/net10.0/publish/wwwroot
```

Deployment is automatic: pushing to `main` runs `.github/workflows/gh-pages.yml`, which uses `na1307/blazor-github-pages` to prepare the published `wwwroot` for GitHub Pages and deploys it.

## Architecture

- **Post data flow**: there is no post index file. `Blog.csproj` embeds every `wwwroot/Posts/*.md` into the assembly as a resource named `Posts/<file name>` (and removes them from static `Content`, so the raw `.md` files are not deployed). `Program.cs` calls `PostRepository.Initialize()` (in `Properties/Post/Post.cs`), which enumerates those resources, parses each one, renders it with Markdig, and keeps everything in memory.
- **Hidden posts**: a `.md` whose file name **starts with** `_` is still embedded and reachable by URL (`/post/_draft`), but `PostRepository.IsHidden` keeps it out of `SortedPostByTime` — so it's absent from the list, tag counts, post count and prev/next links. It is not secret: the content ships inside the deployed assembly.
- **Post format**: the slug is the file name without `.md` (Korean and spaces are fine). Optional front matter at the very top, parsed by a small hand-written parser in `PostRepository.Parse` (not a YAML library — keep to `key: value` lines):
  ```
  ---
  title: 글 제목          # defaults to the file name
  date: 2026-10-14 14:31  # missing → DateTime.MinValue, shown as "—" and sorted last
  tags: [C#, blazor]
  ---
  ```
- **Adding a post**: drop the `.md` into `wwwroot/Posts/` and rebuild — nothing else to register.
- **Writing a post**: `/write` (`Pages/Write.razor`, not linked in the nav) is an in-browser editor with a markdown toolbar (Ctrl+B/I/E/K) and live preview. Saving downloads `<title>.md` (filename-illegal chars stripped) with the front matter prepended. Drafts autosave to `localStorage`. Browser-side helpers (text formatting, download, storage) are in `wwwroot/js/editor.js`.
- **Ordering**: `PostInfo.CompareTo` sorts newest-first; `SortedPostByTime` is used by the home page.
- **Routing**: `/` → `Pages/Home.razor` (post list), `/post/{slug}` → `Pages/Post.razor` (renders HTML via `MarkupString`). Unknown routes go to `Pages/NotFound.razor`, which redirects to `/`.
- `PostRepository` is injected into every component via `@inject` in `_Imports.razor` (as `repo`), so pages use `repo` without declaring it.
- **GitHub Pages SPA fallback**: `wwwroot/404.html` is a copy of `wwwroot/index.html` so deep links like `/post/x` boot the Blazor app. Keep the two files in sync when editing `index.html`.
- Styling uses Blazor CSS isolation (`*.razor.css` next to components, bundled as `Blog.styles.css`) plus global `wwwroot/css/app.css`.
- Note: `PostRepository` lives under the `Properties/` folder (namespace `Blog.Properties.Post`), not a typical `Services/` location.

## Design system

Retro / neo-brutalist, but readability first: monospace type (D2Coding from jsDelivr `joungkyun/font-d2coding@1.3.2`, declared via our own `@font-face` as `"D2Coding Web"` at the top of `app.css` — the upstream `d2coding.css` doesn't apply its bold face; weights 400/700 only), square corners, 2px black borders, hard offset shadows, no decorative characters or mascots.

- Palette tokens live in `:root` of `wwwroot/css/app.css`: `--blue #0856FF` (links, active/primary), `--yellow #FFFF00` (hover/selection background only — never as text color), `--teal #2C6262` (page background, tags), `--white`. Use the tokens instead of raw hex.
- The whole site is one "window" (`Layout/MainLayout.razor`: blue title bar showing the current path, header nav, status bar).
- Shared pieces (`.btn`, `.tag`, `.markdown`, boot/loading screen, error UI) are global in `app.css`. Post bodies are injected via `MarkupString`, which does **not** receive CSS-isolation scope attributes — markdown styles must stay global (`.markdown …`), not in `Post.razor.css`.
- Mobile breakpoint is `max-width: 640px` in each `.razor.css`.
