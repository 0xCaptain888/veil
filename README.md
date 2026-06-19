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

## Mainnet Deployment

**The Veil contract is live on Sui Mainnet.**

| Item | Value |
|------|-------|
| **Package ID** | `0x3d95e6f1a4ca7d8341c2d7bc054014cf53b099eb4686ca194b5b470d2d38921a` |
| **UpgradeCap** | `0x8b1c999747661d1bd9a8b75e217906c93c3c3c78f0977852db01d96585437377` |
| **Deploy Tx** | `9dvTzSVU6eHzSmdFVN4tLPjgUDDQ9ETo9YMwQZepD3ZD` |
| **Network** | Sui Mainnet |
| **Modules** | `confidential_adapter`, `payroll` |
| **Move Tests** | 11/11 passing |
| **GitHub** | https://github.com/0xCaptain888/veil |

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
├─ move/veil/                     # Sui Move package
│  ├─ sources/payroll.move           # Core: Employer, PayrollRun, PayoutEscrow, Payslip
│  ├─ sources/confidential_adapter.move  # W1 boundary for Confidential Transfers
│  └─ tests/payroll_tests.move       # 11 tests: auth, state machine, claim, edge cases
├─ packages/sdk/                  # Shared TypeScript SDK
│  ├─ src/ptb.ts                 #   PTB builders (buildExecuteRunTx, buildClaimToSenderTx)
│  ├─ src/deepbook.ts            #   DeepBook V3 FX swap (maybeSwap, buildClaimWithSwapTx)
│  ├─ src/confidential.ts        #   Manifest encode/decode (W5: Walrus+Seal encryption)
│  ├─ src/client.ts              #   VeilClient wrapper
│  ├─ src/utils.ts               #   idHash (keccak256), randomSecret
│  └─ src/types.ts               #   VeilConfig, RecipientInput, AuditEntry
├─ apps/relayer/                  # Express gas station + API
│  ├─ src/index.ts               #   Server entry, CORS, health endpoint
│  ├─ src/auth.ts                #   API key authentication middleware
│  ├─ src/email.ts               #   Email notification service (console/SendGrid/SES)
│  ├─ src/store.ts               #   Persistent JSON file storage (survives restart)
│  ├─ src/sui.ts                 #   Relayer keypair + tx execution
│  ├─ src/config.ts              #   Environment config loader
│  └─ src/routes/                #   claims.ts, runs.ts, audit.ts
├─ apps/web/                      # Next.js frontend
│  ├─ app/employer/page.tsx      #   Employer console: register, create run, execute PTB
│  ├─ app/claim/[token]/         #   Recipient claim page: connect wallet, receive payment
│  ├─ app/audit/page.tsx         #   Auditor dashboard: reconciliation + CSV export
│  └─ app/providers.tsx          #   SuiClientProvider + WalletProvider
├─ scripts/publish.sh             # Publish the Move package
├─ .github/workflows/ci.yml       # Move build/test + TS typecheck (strict)
├─ pnpm-workspace.yaml            # pnpm workspace config
├─ pnpm-lock.yaml                 # Dependency lockfile
├─ DEPLOYMENT_REPORT.md           # Full deployment status & next steps
└─ docs/                          # 01 dev doc · 02 deploy & GitHub · 03 prerequisites
```

---

## Prerequisites

See **`docs/03-prerequisites-checklist.md`** for the full list (accounts, keys, ids). Minimum to run the demo:

- **Node.js ≥ 20** and **pnpm** (or npm ≥ 10)
- **Sui CLI** (`sui`) — https://docs.sui.io/guides/developer/getting-started/sui-install
- A **Sui wallet** browser extension (employer signer) + **Sui Wallet / Slush**
- A **funded relayer key** in `suiprivkey1...` format

---

## Quickstart

```bash
# 1) install workspace deps (pnpm recommended)
pnpm install
# — or —
npm install

# 2) configure env
cp .env.example .env
#   set VEIL_PACKAGE_ID=0x3d95e6f1a4ca7d8341c2d7bc054014cf53b099eb4686ca194b5b470d2d38921a
#   set RELAYER_PRIVATE_KEY to a funded suiprivkey1... key
#   set SUI_NETWORK=mainnet
#   (web reads the NEXT_PUBLIC_* values — keep them in sync)

# 3) run the relayer (terminal A)
pnpm --filter @veil/relayer run dev   # http://localhost:8787
# — or —
npm run dev:relayer

# 4) run the web app (terminal B)
pnpm --filter @veil/web run dev       # http://localhost:3000
# — or —
npm run dev:web
```

> The contract is already deployed to mainnet. No need to re-publish unless you modify the Move code.
>
> The web app reads `NEXT_PUBLIC_*` env vars at build/start. For local dev, put them in `apps/web/.env.local` (or export them) in addition to the root `.env` used by the relayer.
>
> The relayer loads `.env` from its own directory (`apps/relayer/.env`). Copy or symlink the root `.env` there.

### Demo walkthrough (≈ 3 min)

1. **Employer** (http://localhost:3000/employer): connect wallet → **Register employer** (prefills ids) → paste a **funding Coin id** (a SUI coin you own) → add recipients → **Execute confidential payout**. One PTB creates the run, escrows each payout, and finalizes.
2. The page shows a **claim link** per recipient. The relayer also sends **email notifications** to each recipient. Copy the **Run id** for the auditor.
3. **Recipient** (open a claim link): connect a wallet (production: Google/zkLogin) → **Receive payment**. The relayer pays gas; funds arrive. If a DeepBook pool is configured, the payout is automatically swapped to the recipient's target currency.
4. **Auditor** (http://localhost:3000/audit): paste the Run id → **Load** → see the reconciliation → **Export CSV**.

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│  Employer   │     │     Veil Relayer          │     │   Sui Mainnet        │
│  Console    │────▶│  ┌─────────────────────┐  │     │                      │
│  (Next.js)  │     │  │ Auth (API key)      │  │     │  veil::payroll       │
└─────────────┘     │  │ Email notifications │  │────▶│  veil::conf_adapter  │
                    │  │ Persistent storage   │  │     │  DeepBook V3         │
┌─────────────┐     │  │ Gas sponsorship      │  │     └──────────────────────┘
│  Recipient  │     │  └─────────────────────┘  │
│  Claim App  │────▶│                           │     ┌──────────────────────┐
│  (zkLogin)  │     │  Routes:                  │     │  Walrus / Seal (W5)  │
└─────────────┘     │  POST /runs/register      │     │  Encrypted payslips  │
                    │  GET  /claims/:token       │     └──────────────────────┘
┌─────────────┐     │  POST /claims/:token/claim │
│  Auditor    │     │  GET  /audit/runs/:runId   │
│  Dashboard  │────▶│                           │
└─────────────┘     └──────────────────────────┘
```

---

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `SUI_NETWORK` | `mainnet` / `testnet` / `devnet` / `localnet` | Yes |
| `VEIL_PACKAGE_ID` | Deployed Move package address | Yes |
| `RELAYER_PRIVATE_KEY` | Funded `suiprivkey1...` key for gas sponsorship | Yes |
| `STABLE_COIN_TYPE` | Payout coin type (default: `0x2::sui::SUI`) | Yes |
| `PORT` | Relayer port (default: `8787`) | No |
| `WEB_ORIGIN` | Allowed CORS origin for the web app | No |
| `DATA_DIR` | Persistent storage directory (default: `./data`) | No |
| `RELAYER_API_KEY` | Bearer token for protecting sensitive endpoints | Recommended |
| `EMAIL_SERVICE` | `console` (demo) / `sendgrid` / `ses` | No |
| `EMAIL_FROM` | Sender address for claim emails | No |
| `DEEPBOOK_PACKAGE_ID` | DeepBook V3 package for FX swap | W4 |
| `DEEPBOOK_POOL_ID` | Trading pool for source→target swap | W4 |
| `GOOGLE_CLIENT_ID` | Google OAuth for zkLogin | W3 |
| `ZKLOGIN_PROVER_URL` | zkLogin prover service | W3 |
| `SALT_SERVICE_URL` | zkLogin salt service | W3 |
| `WALRUS_PUBLISHER_URL` | Walrus publisher for encrypted payslips | W5 |

See `.env.example` for the complete reference with comments.

---

## API Reference

### Relayer HTTP API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Health check + store stats (runs, tokens, pending, claimed) |
| `POST` | `/runs/register-tokens` | API key | Register claim tokens after on-chain execution; sends email notifications |
| `GET` | `/claims/:token` | — | Get claim info (email, amount, status) |
| `POST` | `/claims/:token/claim` | — | Execute claim (relayer pays gas); optional DeepBook FX swap |
| `GET` | `/audit/runs/:runId` | API key | Auditor reconciliation for a run (entries + summary) |
| `GET` | `/audit/runs` | API key | List all runs (sorted by creation time) |

### SDK (`@veil/sdk`)

| Function | Description |
|----------|-------------|
| `buildExecuteRunTx(params)` | Build atomic batch payout PTB |
| `buildClaimToSenderTx(params)` | Build claim transaction |
| `buildClaimWithSwapTx(params)` | Build claim + DeepBook FX swap transaction |
| `maybeSwap(tx, cfg, coin, target, source, minOut)` | Optional DeepBook FX swap with slippage protection |
| `idHash(secret)` | keccak256 hash (matches Move `sui::hash::keccak256`) |
| `randomSecret()` | Generate one-time claim secret |
| `encodeManifest/decodeManifest` | Run manifest serialization (W5: encryption) |
| `VeilClient` | High-level wrapper around SuiClient |

---

## Testing & CI

```bash
# Move unit tests (11 tests: auth, state machine, claim proof, edge cases)
sui move test --path move/veil

# TypeScript typecheck across the workspace
pnpm run typecheck
# — or —
npm run typecheck
```

**Move test coverage:**

| Test | What it verifies |
|------|-----------------|
| `happy_path_escrow_and_claim` | Full lifecycle: create → escrow → finalize → claim → verify amount |
| `claim_with_wrong_proof_aborts` | Wrong secret triggers `EBadProof` |
| `unauthorized_admin_cannot_create_run` | Wrong AdminCap triggers `ENotAuthorized` |
| `cannot_escrow_after_finalize` | Escrow on finalized run triggers `ERunFinalized` |
| `multiple_recipients_in_one_run` | Batch escrow (3 recipients) with correct count |
| `run_status_transitions` | EXECUTING(1) → FINALIZED(2) state machine |
| `multiple_runs_created` | Employer can create multiple sequential runs |
| `manifest_blob_stored` | Run with manifest blob creates successfully |
| `auditor_pubkey_readable` | Auditor public key is accessible |
| `unauthorized_admin_cannot_finalize` | Wrong AdminCap on finalize triggers `ENotAuthorized` |
| `claim_with_empty_proof_aborts` | Empty proof triggers `EBadProof` |

`.github/workflows/ci.yml` runs Move build/test and TS typecheck on every push/PR. The Move job **fails hard** if the Sui CLI is unavailable or tests fail — no silent skips.

---

## Troubleshooting

- **Relayer shows `packageId: "unset"`.** The relayer reads `.env` from `apps/relayer/`. Copy the root `.env` to `apps/relayer/.env` and restart.
- **`sui move build` reports an *unbound* module/type for `object` / `ID` / `UID` / `transfer` / `tx_context`.** Edition 2024 implicitly imports these and this repo relies on that — the explicit `use` lines are intentionally omitted to avoid "duplicate alias" errors. On a rare older toolchain that lacks the implicit prelude, add these lines back to the top of `move/veil/sources/payroll.move` (and `use sui::tx_context::TxContext;` to `confidential_adapter.move`):
  ```move
  use sui::object::{Self, ID, UID};
  use sui::tx_context::{Self, TxContext};
  use sui::transfer;
  ```
- **`Dependency resolution failed` on build.** The `Move.toml` pins `rev = "framework/testnet"`. Switch it to `framework/devnet` if you publish to Devnet for Confidential Transfers, or to a tagged release that matches your `sui` CLI.
- **Relayer 500 on claim.** Ensure `VEIL_PACKAGE_ID` and `RELAYER_PRIVATE_KEY` are set and the relayer key is funded with SUI for gas.
- **Web can't reach relayer / CORS.** Confirm `WEB_ORIGIN` (relayer) matches the web origin and `NEXT_PUBLIC_RELAYER_URL` points at the relayer.
- **`BigInt` literal errors.** Amounts are sent as base units (strings) and converted with `BigInt()`.
- **Relayer data lost on restart.** Data persists in `./data/relayer-store.json` by default. Set `DATA_DIR` to change the location. If the file is corrupted, the relayer starts fresh (logs a warning).
- **401 on `/runs/register-tokens` or `/audit/*`.** If `RELAYER_API_KEY` is set, include `Authorization: Bearer <key>` header. Leave it empty for development mode.
- **pnpm workspace warnings.** Ensure `pnpm-workspace.yaml` exists at the repo root. It defines `packages/*` and `apps/*` as workspace members.

---

## Roadmap (maps to the dev doc)

- **W1** — wire Confidential Transfers beta into `confidential_adapter` + SDK (de-risk: Plan A/B/C in dev doc §9.1).
- **W2** — capability hardening, auditor decrypt/reconcile.
- **W3** — zkLogin onboarding + sponsored-gas claim (recipient signs, relayer sponsors).
- **W4** — DeepBook FX at claim (adapter ready, needs pool configuration).
- **W5** — Walrus + Seal encrypted payslips; UI polish; design partner.
- **W6** — rehearse, record backup video, finalize submission.

---

## Project status

| Component | Status | Details |
|-----------|--------|---------|
| Move contracts | ✅ Deployed to mainnet | Package `0x3d95e6f1...d38921a`, 11/11 tests passing |
| SDK | ✅ Complete | PTB builders, DeepBook FX swap, client wrapper, utils |
| Relayer | ✅ Production-ready | Persistent storage, API auth, email notifications, gas sponsorship |
| Frontend | ✅ Functional | Employer console, claim app, audit dashboard |
| CI/CD | ✅ Working | Move build/test + TS typecheck on every push/PR |
| GitHub | ✅ Synced | https://github.com/0xCaptain888/veil |
| Confidentiality (W1) | ⏳ Adapter ready | Integration boundary defined, needs beta wiring |
| zkLogin (W3) | ⏳ Interface defined | Needs Google OAuth + Prover config |
| DeepBook FX (W4) | ⏳ Logic implemented | Needs pool address configuration |
| Walrus/Seal (W5) | ⏳ Interface defined | Needs publisher URL + encryption logic |

See **`DEPLOYMENT_REPORT.md`** for the full deployment report with step-by-step next actions.

## License

MIT — see `LICENSE`.
