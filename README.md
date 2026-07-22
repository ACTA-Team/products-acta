# ACTA Products

Monorepo hosting the products built on top of [ACTA](https://github.com/ACTA-Team) —
trust-minimized Verifiable Credentials on Stellar/Soroban.

## What's in this repo

- `apps/web` — products catalog / landing.
- `apps/credit-history` — portable credit history / financial inclusion product (skeleton).
- `packages/ui` — shared React components (Tailwind v4).
- `packages/acta` — thin integration layer over `@acta-team/credentials`.
- `packages/config` — shared tsconfig / eslint presets.
- `packages/types` — shared TypeScript types.

Stack: Next.js 16, React 19, Tailwind CSS v4, TypeScript 5 · pnpm workspaces + Turborepo ·
Node >= 22.

## Run locally

```bash
corepack enable   # once, to get the pinned pnpm
pnpm install
pnpm dev          # web on :3000, credit-history on :3001
```

## Scripts (root, via turbo)

- `pnpm dev` — start all apps in dev mode
- `pnpm build` — production build of every app/package
- `pnpm lint` — lint everything
- `pnpm typecheck` — `tsc --noEmit` everywhere
- `pnpm format` — Prettier over the repo
