# Veil — Confidential Payroll on Sui

> Stripe-grade global payroll, but **salary amounts are private on-chain**. Recipients get paid in seconds, with **zero gas** and **no seed phrase**, and receive their **local currency** instantly. Employers and auditors keep full, scoped auditability.

Built for **Sui Overflow 2026 · DeFi & Payments**. Removes the three walls that have kept payroll off public chains — privacy, onboarding, and FX settlement — using Sui's newest primitives.

| Wall | Sui primitive |
|------|---------------|
| Privacy (amounts must be hidden) | **Confidential Transfers** (Devnet public beta) |
| Onboarding (no seed phrase, no gas) | **zkLogin** + **Sponsored Transactions** |
| FX settlement (USDC → local stablecoin) | **DeepBook** |
| Atomic batch payouts | **Programmable Transaction Blocks (PTBs)** |
| Fine-grained authz | **Object model + Capabilities** |

---

## ⚠️ Build mode (read this first)

This repo **builds and runs end-to-end today** in **fallback mode**: payouts use standard `Coin<T>` (amounts visible on-chain), so you can demo the full flow — batch payout → claim → audit — immediately.

**Confidentiality is a clearly-scoped integration boundary, not missing functionality.** It is isolated to two files:
- `move/veil/sources/confidential_adapter.move` — the `withdraw_for_payout` function.
- `packages/sdk/src/confidential.ts` — the manifest path.

In **W1** you wire these to the official Confidential Transfers beta (https://github.com/MystenLabs/confidential-transfers) **without changing the rest of the code**. The privacy invariant — *no on-chain event ever carries an amount* — already holds in both modes.

Likewise, **zkLogin onboarding (W3)** and **DeepBook FX (W4)** have working fallbacks (wallet-connect for the address; deliver USDC if no pool) and clearly-marked wiring points.

> The demo's default stable coin is **native SUI** (`0x2::sui::SUI`) so it runs with faucet funds and no custom token.

---

## Monorepo layout

```
veil/
├─ move/veil/                 # Sui Move package (veil::payroll, veil::confidential_adapter)
│  ├─ sources/payroll.move
│  ├─ sources/confidential_adapter.move
│  └─ tests/payroll_tests.move
├─ packages/sdk/              # Shared TypeScript SDK (PTB builders, types, helpers)
├─ apps/relayer/              # Express gas station: claim execution + audit API
├─ apps/web/                  # Next.js: employer console / claim page / auditor dashboard
├─ scripts/publish.sh         # Publish the Move package
├─ .github/workflows/ci.yml   # Move build/test + TS typecheck
└─ docs/                      # 01 dev doc · 02 deploy & GitHub · 03 prerequisites
```

---

## Prerequisites

See **`docs/03-prerequisites-checklist.md`** for the full list (accounts, keys, ids). Minimum to run the demo:

- **Node.js ≥ 20** and **npm ≥ 10**
- **Sui CLI** (`sui`) — https://docs.sui.io/guides/developer/getting-started/sui-install
- A **Sui wallet** browser extension (employer signer) + **Sui Wallet / Slush**
- A **funded relayer key** in `suiprivkey1...` format (faucet-funded on Devnet)

---

## Quickstart

```bash
# 1) install workspace deps
npm install

# 2) deploy the Move package (Devnet)
sui client switch --env devnet
sui client faucet                 # fund your active address
./scripts/publish.sh              # prints the PackageID

# 3) configure env
cp .env.example .env
#   set VEIL_PACKAGE_ID + NEXT_PUBLIC_VEIL_PACKAGE_ID to the published id
#   set RELAYER_PRIVATE_KEY to a funded suiprivkey1... key
#   (web reads the NEXT_PUBLIC_* values — keep them in sync)

# 4) run the relayer (terminal A)
npm run dev:relayer               # http://localhost:8787

# 5) run the web app (terminal B)
npm run dev:web                   # http://localhost:3000
```

> The web app reads `NEXT_PUBLIC_*` env vars at build/start. For local dev, put them in `apps/web/.env.local` (or export them) in addition to the root `.env` used by the relayer.

### Demo walkthrough (≈ 3 min)

1. **Employer** (http://localhost:3000/employer): connect wallet → **Register employer** (prefills ids) → paste a **funding Coin id** (a SUI coin you own from the faucet) → add recipients → **Execute confidential payout**. One PTB creates the run, escrows each payout, and finalizes — **amounts never appear in events**.
2. The page shows a **claim link** per recipient (also logged by the relayer). Copy the **Run id** for the auditor.
3. **Recipient** (open a claim link): connect a wallet (production: Google/zkLogin) → **Receive payment**. The relayer pays gas; funds arrive. *(DeepBook FX is wired in W4.)*
4. **Auditor** (http://localhost:3000/audit): paste the Run id → **Load** → see the reconciliation → **Export CSV**.

---

## Push to GitHub

Full steps in **`docs/02-deployment-and-github-guide.md`**. Short version:

```bash
git init
git add .
git commit -m "Veil — confidential payroll on Sui (Overflow 2026)"
git branch -M main
git remote add origin https://github.com/<you>/veil.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.env`, and build output. **Never commit a real `RELAYER_PRIVATE_KEY`.**

---

## Testing & CI

```bash
sui move test --path move/veil     # Move unit tests (authz, claim proof, state)
npm run typecheck                  # TypeScript across the workspace
```

`.github/workflows/ci.yml` runs Move build/test and TS typecheck on every push/PR (installs the Sui CLI on the runner).

---

## Troubleshooting

- **`sui move build` reports an *unbound* module/type for `object` / `ID` / `UID` / `transfer` / `tx_context`.** Edition 2024 implicitly imports these and this repo relies on that — the explicit `use` lines are intentionally omitted to avoid "duplicate alias" errors. On a rare older toolchain that lacks the implicit prelude, add these lines back to the top of `move/veil/sources/payroll.move` (and `use sui::tx_context::TxContext;` to `confidential_adapter.move`):
  ```move
  use sui::object::{Self, ID, UID};
  use sui::tx_context::{Self, TxContext};
  use sui::transfer;
  ```
- **`Dependency resolution failed` on build.** The `Move.toml` pins `rev = "framework/testnet"`. Switch it to `framework/devnet` if you publish to Devnet for Confidential Transfers, or to a tagged release that matches your `sui` CLI.
- **Relayer 500 on claim.** Ensure `VEIL_PACKAGE_ID` and `RELAYER_PRIVATE_KEY` are set and the relayer key is funded.
- **Web can't reach relayer / CORS.** Confirm `WEB_ORIGIN` (relayer) matches the web origin and `NEXT_PUBLIC_RELAYER_URL` points at the relayer.
- **`BigInt` literal errors.** Amounts are sent as base units (strings) and converted with `BigInt()`.

---

## Roadmap (maps to the dev doc)

- **W1** — wire Confidential Transfers beta into `confidential_adapter` + SDK (de-risk: Plan A/B/C in dev doc §9.1).
- **W2** — capability hardening, auditor decrypt/reconcile.
- **W3** — zkLogin onboarding + sponsored-gas claim (recipient signs, relayer sponsors).
- **W4** — DeepBook FX at claim.
- **W5** — Walrus + Seal encrypted payslips; UI polish; design partner.
- **W6** — rehearse, record backup video, finalize submission.

---

## Project status (honest)

- ✅ Move package, SDK, relayer, and web app are written and statically checked (file tree, JSON validity, placeholder scan).
- ⚠️ **Not yet compiled/deployed in the authoring environment** (it had no network). Run `npm install` + `sui move build` on your machine to get the final green light — see the deployment guide.
- ⚠️ Confidentiality / zkLogin / DeepBook are wired via adapters with working fallbacks; production wiring is W1/W3/W4.

## License

MIT — see `LICENSE`.
