# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FloatPad — a floating widget desktop built with React 19 + Vite 8. Draggable/resizable widgets on a dark glassmorphism canvas, deployed to GitHub Pages at `https://1Mangesh1.github.io/floatpad`.

## Commands

```bash
pnpm dev          # Dev server (Vite)
pnpm build        # Production build
pnpm lint         # ESLint (v9 flat config)
pnpm preview      # Preview production build locally
pnpm deploy       # Build + deploy to GitHub Pages (gh-pages -d dist)
```

Package manager is **pnpm**. Do not use npm or yarn.

## Architecture

- **Entry**: `index.html` → `src/main.jsx` → `src/App.jsx`
- **State**: Zustand store (`src/store/widgetStore.js`) with localStorage persistence key `floatpad-widgets`. Actions: spawn, close, minimize, move, resize, bringToFront, updateData.
- **Widget system**: Registry pattern in `src/widgets/_registry.js` maps widget type IDs to components, labels, icons, and default sizes. Each widget lives in `src/widgets/<Name>/index.jsx`.
- **FloatingWidget** (`src/components/FloatingWidget.jsx`): Wraps each widget in `react-rnd` for drag/resize. Titlebar has minimize/close. Drag handle is titlebar only.
- **Dock** (`src/components/Dock.jsx`): Fixed bottom bar, one button per registry entry. Prevents duplicate widgets.
- **Backend proxy**: `src/lib/workerClient.js` makes authenticated POSTs to a CloudFlare Worker (URL + secret from env vars). Hooks `useGemini` and `useCFCrawl` use this client.

## Key Patterns

- Widget IDs are `${type}-${crypto.randomUUID()}`.
- Widget-specific state goes in the `data` field via `updateData(id, patch)`.
- New widgets: add component in `src/widgets/<Name>/index.jsx`, register in `_registry.js` with type, label, icon, component, and default `w`/`h`.
- Styling uses CSS (no Tailwind). Dark theme in `src/index.css` (design tokens) and `src/App.css` (glassmorphism). Widget internals should use scoped CSS or inline styles matching the existing aesthetic (`rgba` surfaces, blur, thin borders).

## Environment

Copy `.env.example` → `.env`. Two vars: `VITE_CF_WORKER_URL` (worker endpoint) and `VITE_WORKER_SECRET` (shared auth secret). API keys live on the worker, never in frontend code.

## Build

Vite base path is `/floatpad/` (GitHub Pages subpath). Build output goes to `dist/`.

## Commits

Normal commit messages. No Co-Authored-By footers.
