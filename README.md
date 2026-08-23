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

## `apps/credit-history`: mock vs. real data

The app reads credentials through a single `useCredentialSource()` hook
(`apps/credit-history/src/lib/use-credential-source.ts`), so `/credentials`,
`/credentials/[id]`, `/share` and `/vault` always agree on what the connected
holder owns. `/verify/[token]` (the public verifier) is unauthenticated and
resolves its own owner from the shared presentation's holder DID instead.

Which mode is active is controlled by `NEXT_PUBLIC_DATA_SOURCE`:

- **`mock` (default, no env var needed)** — every surface reads the fixtures
  in `packages/acta/src/mock.ts`. No wallet and no testnet credentials are
  required to try `/credentials`, `/share`, or `/verify/[token]` end to end.
  `/vault` still expects a wallet click, but with `NEXT_PUBLIC_WALLET` unset
  (see below) it accepts a mock connect with no real extension installed.
- **`real`** — session-gated surfaces (`/credentials`, `/credentials/[id]`,
  `/share`, `/vault`) read the connected holder's actual vault through
  `ActaCredentialSource`, and show the wallet-connect prompt instead of
  fixtures until a wallet is connected. This requires a Stellar testnet (or
  mainnet) account holding real ACTA credentials, plus `NEXT_PUBLIC_ACTA_API_KEY`
  for the ACTA SDK client (`apps/credit-history/src/providers/acta-provider.tsx`).
  A real-mode call that somehow reaches `getCredentialSource()` with no owner
  (e.g. a bug, or a holder DID the public verifier can't parse) logs a
  `console.warn` and falls back to mock — it never fails silently.

Related env vars:

- `NEXT_PUBLIC_WALLET=real` — use the Stellar Wallets Kit / Freighter
  connector instead of the mock wallet connector (`apps/credit-history/src/session/wallet-connector.ts`).
  Unset or any other value uses the mock connector, which returns a fixed
  address with no extension required — useful for contributors without a
  wallet installed, in either data-source mode.
- `NEXT_PUBLIC_STELLAR_NETWORK` — `testnet` (default) or `mainnet`.
- `NEXT_PUBLIC_MOCK_MODE` — `empty` or `error`, to exercise the empty/error
  states of the mock source; anything else behaves as `normal`.
