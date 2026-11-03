---
name: frontend-development
description: Build or change the React/TypeScript dashboard in frontend/ following Feature-Sliced Design, Zustand state and the design patterns doc. Use for any UI, store, or frontend WebSocket-consumer work.
---

# Frontend development

## When to use
New or changed screens, widgets, features, entities, stores, styles, or frontend handling of server events.

## Required knowledge
React 19, TypeScript strict, Zustand 5, Tailwind 4, Vite, Vitest. Read `FSD.md` and `docs/DESIGN_PATTERNS.md` first.

## Workflow
1. Decide the layer using the "Where does new code go?" table in `FSD.md`.
2. Find the nearest existing slice and copy its shape (`index.ts`, `model/`, `ui/`).
3. Implement state in `model/` (store + actions + selectors), UI in `ui/`; export only what others need from `index.ts`.
4. Add tests beside the store/action. Run `pnpm check`.

## Architecture rules
- Layer order `app → pages → widgets → features → entities → shared`; never import upward.
- Cross-slice imports go through `index.ts` (`@/features/send-message`, not `.../model/store`).
- Features must not import other features; compose in a widget/page or move shared logic down.
- Components call feature actions; they never call `wsClient` directly. WS code stays in `shared/api/ws`; event routing into stores is in `app/providers/realtime.ts`.
- Put UI in `shared/ui` only when reused by unrelated features.

## Coding standards
Function components, typed props, Zustand selectors (not whole-store subscriptions), icons and buttons through `@/shared/ui` (`Icon`, `IconButton`, `IconPill`, `toast`) rather than importing the icon library directly, follow the layout/accessibility patterns in `docs/DESIGN_PATTERNS.md`. Prettier + oxlint clean.

## Testing requirements
Test stores and actions, not markup. Mock the socket: `vi.mock("@/shared/api/ws", () => ({ wsClient: { send } }))`; reset stores with `setState` in `beforeEach`.

## Common mistakes
- Importing another slice's internals or a higher layer (`pnpm check:fsd` misses dynamic `import()` and feature→feature; check manually).
- Adding a server event without updating `protocol.ts`, `isServerEvent`, `realtime.ts` and the mock server together.
- Putting product logic in `shared`.
