# Frontend dependency plan

Vite, Vitest, and esbuild stay on their current majors. This file is what a later upgrade has to account for. Versions below are what `npm view` reported on 7 October 2026.

## What is installed now

| Package | Installed | How it is used |
|---|---|---|
| vite | 6.4.4 (`^6.0.0`) | `frontend/vite.config.js`, production build |
| vitest | 2.1.9 (`^2.1.9`) | `npm test`, config lives in the `test` block of `vite.config.js` |
| esbuild | not a direct dependency | Vite 6.4.4 bundles 0.25.12. Vitest 2 also installs Vite 5.4.21, which bundles esbuild 0.21.5 |

`@vitejs/plugin-react` 5.2.0 already accepts Vite 4 through 8. The config passes `babel.parserOpts.plugins: ['decorators-legacy']`.

## Vite 6.4.4 to 7, or to 8.3.3

Vite 7 and Vite 8 both require Node `^20.19.0 || >=22.12.0`. The Pages workflow currently says `node-version: 20`. Pin `20.19` or `22` in the same change so an older Node 20 image cannot be selected.

Vite 8's optional esbuild peer is `^0.27.0 || ^0.28.0` (latest esbuild is 0.28.2). `@vitejs/plugin-react` 6.1.2, the current release, peers only with Vite 8 and moves Babel to the optional `@rolldown/plugin-babel` package. The decorator parser option has to be re-checked against that plugin before the build is treated as the same.

Do this in one pass with the app build (`npm run build`) and the four existing Vitest files. There is no separate esbuild config to migrate.

## Vitest 2.1.9 to 4.1.11, or to 5.0.3

`npm audit` reports Vitest `<=4.1.10` (path traversal in `@vitest/mocker`, plus `tinypool` and the nested Vite 5 / esbuild 0.21.5). A same-major update cannot fix it. Vitest 3 is still inside that range.

Vitest 4.1.11 is the smallest version outside the advisory. It peers with Vite `^6 || ^7 || ^8`, so it can move before Vite does. Node engines are `^20 || ^22 || >=24`. Keep jsdom (already installed) and re-run `npm test -- --run`. The `test` block in `vite.config.js` should stay, then confirm the pool and environment options still match the 4.x docs.

Vitest 5.0.3 peers with Vite `^6.4.0 || ^7 || ^8` and requires Node `^22.12.0 || ^24 || >=26`. That drops the Node 20 image used by the Pages workflow.

## esbuild

Do not add a direct esbuild dependency and do not force it ahead of Vite. The copy that audit flags (0.21.5, advisory for `<=0.24.2`) belongs to Vitest's nested Vite 5. Removing it means upgrading Vitest to at least 4.1.11. The production build already uses esbuild 0.25.12 through Vite 6.4.4.
