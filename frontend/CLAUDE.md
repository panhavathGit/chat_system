# CLAUDE.md (frontend)

## Architecture

This package uses **Feature-Sliced Design (FSD) v2.1**.

- Always use the `feature-sliced-design` skill when creating, moving, or importing frontend code, or when deciding where code belongs.
- Follow FSD layer rules: a layer may only import from layers below it (`app` → `pages` → `widgets` → `features` → `entities` → `shared`).
- Import slices only through their public API (`index.ts`), never from internal files.
