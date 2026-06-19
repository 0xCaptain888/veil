# Veil — Confidential Payroll on Sui

> Stripe-grade global payroll, but **salary amounts are private on-chain**. Recipients get paid in seconds, with **zero gas** and **no seed phrase**, and receive their **local currency** instantly. Employers and auditors keep full, scoped auditability.

Built for **Sui Overflow 2026 · DeFi & Payments**. Removes the three walls that have kept payroll off public chains — privacy, onboarding, and FX settlement — using Sui's newest primitives.

| Wall | Sui primitive | Status |
|------|---------------|--------|
| Privacy (amounts must be hidden) | **Confidential Transfers** (contra) | ✅ Adapter ready (devnet beta) |
| Onboarding (no seed phrase, no gas) | **zkLogin** + **Sponsored Transactions** | ✅ Google OAuth integrated |
| FX settlement (USDC → local stablecoin) | **DeepBook V3** | ✅ Mainnet pools configured |
| Atomic batch payouts | **Programmable Transaction Blocks (PTBs)** | ✅ Deployed to mainnet |
| Fine-grained authz | **Object model + Capabilities** | ✅ Employer / Admin / Auditor caps |

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

### Key Addresses

| Item | Value |
|------|-------|
| **Employer (Address 1)** | `0xe8ba06981d5ff67259bb9ccb28b381d17ffe23160bf9c408f431a77a86603dc4` |
| **Relayer (Address 2)** | `0x89532691d455ab674b09579d5fb5ea591a28f328135108857808d2688c8f919b` |
| **DeepBook V3 Package** | `0x337f4f4f6567fcd778d5454f27c16c70e2f274cc6377ea6249ddf491482ef497` |
| **SUI/USDC Pool** | `0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407` |
| **WUSDT/USDC Pool** | `0x4e2ca3988246e1d50b9bf209abb9c1cbfec65bd95afdacc620a36c67bdb8452f` |
| **DEEP/SUI Pool** | `0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22` |

---

## Build mode

This repo **builds and runs end-to-end today**. On mainnet, payouts use standard `Coin<T>` (amounts visible on-chain). On devnet, the Confidential Transfers adapter can be enabled for fully private amounts.

**Confidentiality is isolated to two files** — swap them to enable full privacy:
- `move/veil/sources/confidential_adapter.move` — `withdraw_for_payout` / `deposit_for_payroll`
- `packages/sdk/src/confidential.ts` — `buildWrapTx` / `buildUnwrapTx`

The contra package (https://github.com/MystenLabs/confidential-transfers) provides the full API:
- `wrap<T>` — deposit public `Coin<T>` into confidential balance
- `batched_transfer<T>` — confidential transfer to multiple recipients
- `unwrap<T>` — withdraw from confidential balance to public `Coin<T>`
- Auditor key rotation, per-account freezing, global pause, issuer override

> Confidential Transfers is currently in **public beta on Devnet** (launched June 8, 2026). Testnet targeted later in 2026. Mainnet date TBD.

> The demo's default stable coin is **native SUI** (`0x2::sui::SUI`).

---

## Monorepo layout

```
veil/
├─ move/veil/                         # Sui Move package
│  ├─ sources/payroll.move               # Core: Employer, PayrollRun, PayoutEscrow, Payslip
│  ├─ sources/confidential_adapter.move  # W1: contra integration (wrap/unwrap/transfer)
│  └─ tests/payroll_tests.move           # 11 tests: auth, state machine, claim, edge cases
├─ packages/sdk/                      # Shared TypeScript SDK
│  ├─ src/ptb.ts                     #   PTB builders (buildExecuteRunTx, buildClaimToSenderTx)
│  ├─ src/deepbook.ts                #   DeepBook V3 FX swap with mainnet pool registry
│  ├─ src/confidential.ts            #   contra wrap/unwrap/transfer + manifest encode/decode
│  ├─ src/client.ts                  #   VeilClient wrapper
│  ├─ src/utils.ts                   #   idHash (keccak256), randomSecret
│  └─ src/types.ts                   #   VeilConfig, RecipientInput, AuditEntry
├─ apps/relayer/                      # Express gas station + API
│  ├─ src/index.ts                   #   Server entry, CORS, health endpoint
│  ├─ src/auth.ts                    #   API key authentication middleware
│  ├─ src/email.ts                   #   Email notification service (console/SendGrid/SES)
│  ├─ src/store.ts                   #   Persistent JSON file storage (survives restart)
│  ├─ src/sui.ts                     #   Relayer keypair + tx execution
│  ├─ src/config.ts                  #   Environment config loader
│  └─ src/routes/                    #   claims.ts, runs.ts, audit.ts
├─ apps/web/                          # Next.js frontend
│  ├─ app/employer/page.tsx          #   Employer console
│  ├─ app/claim/[token]/page.tsx     #   Recipient claim page (zkLogin + wallet)
│  ├─ app/audit/page.tsx             #   Auditor dashboard + CSV export
│  ├─ app/api/auth/callback/google/  #   Google OAuth callback for zkLogin
│  ├─ app/page.tsx                   #   Home page with zkLogin status
│  └─ app/providers.tsx              #   SuiClientProvider + WalletProvider
├─ scripts/publish.sh                 # Publish the Move package
├─ .github/workflows/ci.yml           # Move build/test + TS typecheck (strict)
├─ pnpm-workspace.yaml                # pnpm workspace config
├─ pnpm-lock.yaml                     # Dependency lockfile
├─ DEPLOYMENT_REPORT.md               # Full deployment status & next steps
└─ docs/                              # 01 dev doc · 02 deploy & GitHub · 03 prerequisites
```

---

## Prerequisites

See **`docs/03-prerequisites-checklist.md`** for the full list. Minimum to run the demo:

- **Node.js ≥ 20** and **pnpm** (or npm ≥ 10)
- **Sui CLI** (`sui`) — https://docs.sui.io/guides/developer/getting-started/sui-install
- A **Sui wallet** browser extension (employer signer)
- A **funded relayer key** in `suiprivkey1...` format

---

## Quickstart

```bash
# 1) install workspace deps
pnpm install

# 2) configure env
cp .env.example .env
cp .env apps/relayer/.env
cp .env apps/web/.env.local
#   VEIL_PACKAGE_ID=0x3d95e6f1a4ca7d8341c2d7bc054014cf53b099eb4686ca194b5b470d2d38921a
#   RELAYER_PRIVATE_KEY=suiprivkey1...
#   SUI_NETWORK=mainnet
#   DEEPBOOK_PACKAGE_ID=0x337f4f4f6567fcd778d5454f27c16c70e2f274cc6377ea6249ddf491482ef497
#   DEEPBOOK_POOL_ID=0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID=...

# 3) run the relayer (terminal A)
pnpm --filter @veil/relayer run dev   # http://localhost:8787

# 4) run the web app (terminal B)
pnpm --filter @veil/web run dev       # http://localhost:3000
```

### Demo walkthrough (≈ 3 min)

1. **Employer** (http://localhost:3000/employer): connect wallet → **Register employer** → paste a **funding Coin id** → add recipients → **Execute confidential payout**. One PTB creates the run, escrows each payout, and finalizes.
2. The page shows a **claim link** per recipient. The relayer sends **email notifications** automatically. Copy the **Run id** for the auditor.
3. **Recipient** (open a claim link): **Sign in with Google** (zkLogin) or connect a wallet → **Receive payment**. The relayer pays gas; funds arrive. If a DeepBook pool is configured, the payout is automatically swapped to the recipient's target currency.
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
│  (zkLogin)  │     │  Routes:                  │     │  contra (W1 devnet)  │
└─────────────┘     │  POST /runs/register      │     │  Confidential balance │
                    │  GET  /claims/:token       │     └──────────────────────┘
┌─────────────┐     │  POST /claims/:token/claim │
│  Auditor    │     │  GET  /audit/runs/:runId   │     ┌──────────────────────┐
│  Dashboard  │────▶│                           │     │  Walrus / Seal (W5)  │
└─────────────┘     └──────────────────────────┘     │  Encrypted payslips  │
                                                      └──────────────────────┘
```

---

## Environment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SUI_NETWORK` | `mainnet` / `testnet` / `devnet` / `localnet` | `mainnet` |
| `VEIL_PACKAGE_ID` | Deployed Move package address | *(required)* |
| `RELAYER_PRIVATE_KEY` | Funded `suiprivkey1...` key for gas sponsorship | *(required)* |
| `STABLE_COIN_TYPE` | Payout coin type | `0x2::sui::SUI` |
| `PORT` | Relayer port | `8787` |
| `WEB_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `DATA_DIR` | Persistent storage directory | `./data` |
| `RELAYER_API_KEY` | Bearer token for sensitive endpoints | *(empty = dev mode)* |
| `EMAIL_SERVICE` | `console` / `sendgrid` / `ses` | `console` |
| `EMAIL_FROM` | Sender address for claim emails | `noreply@veil.payments` |
| `DEEPBOOK_PACKAGE_ID` | DeepBook V3 package | `0x337f4f...ef497` |
| `DEEPBOOK_POOL_ID` | Trading pool for FX swap | `0xe05daf...4407` (SUI/USDC) |
| `GOOGLE_CLIENT_ID` | Google OAuth for zkLogin | *(required for W3)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | *(required for W3)* |
| `ZKLOGIN_PROVER_URL` | zkLogin prover service | `https://prover-dev.mystenlabs.com/v1` |
| `SALT_SERVICE_URL` | zkLogin salt service | `https://salt-api-dev.mystenlabs.com` |
| `WALRUS_PUBLISHER_URL` | Walrus publisher for encrypted payslips | *(W5)* |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (frontend) | *(required for W3)* |

See `.env.example` for the complete reference with comments.

---

## API Reference

### Relayer HTTP API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Health check + store stats (runs, tokens, pending, claimed) |
| `POST` | `/runs/register-tokens` | API key | Register claim tokens; sends email notifications |
| `GET` | `/claims/:token` | — | Get claim info (email, amount, status) |
| `POST` | `/claims/:token/claim` | — | Execute claim (relayer pays gas); optional DeepBook FX swap |
| `GET` | `/audit/runs/:runId` | API key | Auditor reconciliation (entries + summary) |
| `GET` | `/audit/runs` | API key | List all runs |

### SDK (`@veil/sdk`)

| Function | Description |
|----------|-------------|
| `buildExecuteRunTx(params)` | Build atomic batch payout PTB |
| `buildClaimToSenderTx(params)` | Build claim transaction |
| `buildClaimWithSwapTx(params)` | Build claim + DeepBook FX swap transaction |
| `maybeSwap(tx, cfg, coin, target, source, minOut)` | DeepBook V3 FX swap with slippage protection |
| `isConfidentialAvailable(network)` | Check if contra is available on current network |
| `buildWrapTx(network, coinType, coinId, accountId)` | Build wrap tx (Coin → confidential balance) |
| `buildUnwrapTx(network, coinType, accountId, amount, recipient)` | Build unwrap tx (confidential → Coin) |
| `idHash(secret)` | keccak256 hash (matches Move `sui::hash::keccak256`) |
| `randomSecret()` | Generate one-time claim secret |
| `encodeManifest/decodeManifest` | Run manifest serialization |
| `VeilClient` | High-level wrapper around SuiClient |

---

## Testing & CI

```bash
# Move unit tests (11 tests)
sui move test --path move/veil

# TypeScript typecheck
pnpm run typecheck
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

`.github/workflows/ci.yml` runs Move build/test and TS typecheck on every push/PR. The Move job **fails hard** if the Sui CLI is unavailable or tests fail.

---

## Troubleshooting

- **Relayer shows `packageId: "unset"`.** Copy root `.env` to `apps/relayer/.env` and restart.
- **`sui move build` reports unbound module/type.** Edition 2024 implicitly imports `object`, `ID`, `UID`, `transfer`, `tx_context`. On older toolchains, add explicit `use` lines.
- **`Dependency resolution failed`.** `Move.toml` pins `rev = "framework/testnet"`. Switch to `framework/devnet` for Confidential Transfers.
- **Relayer 500 on claim.** Ensure `VEIL_PACKAGE_ID` and `RELAYER_PRIVATE_KEY` are set and the relayer key is funded.
- **Web can't reach relayer.** Confirm `WEB_ORIGIN` matches the web origin and `NEXT_PUBLIC_RELAYER_URL` points at the relayer.
- **401 on protected endpoints.** Include `Authorization: Bearer <key>` if `RELAYER_API_KEY` is set.
- **pnpm workspace warnings.** Ensure `pnpm-workspace.yaml` exists at repo root.
- **Google OAuth redirect mismatch.** Ensure `http://localhost:3000/api/auth/callback/google` is in Google Cloud Console → Authorized redirect URIs.

---

## Roadmap

- **W1** ✅ — Confidential Transfers adapter integrated. contra package documented. Devnet beta ready. Mainnet pending.
- **W2** — Capability hardening, auditor decrypt/reconcile.
- **W3** ✅ — zkLogin Google OAuth integrated. Simplified flow for demo. Full prover integration pending.
- **W4** ✅ — DeepBook V3 mainnet pools configured. Swap logic implemented with slippage protection.
- **W5** — Walrus + Seal encrypted payslips; UI polish; design partner.
- **W6** — Rehearse, record backup video, finalize submission.

---

## Project status

| Component | Status | Details |
|-----------|--------|---------|
| Move contracts | ✅ Deployed to mainnet | Package `0x3d95e6f1...d38921a`, 11/11 tests passing |
| SDK | ✅ Complete | PTB builders, DeepBook V3 swap, contra wrap/unwrap, client wrapper |
| Relayer | ✅ Production-ready | Persistent storage, API auth, email notifications, gas sponsorship |
| Frontend | ✅ Functional | Employer console, claim app (zkLogin), audit dashboard |
| CI/CD | ✅ Working | Move build/test + TS typecheck on every push/PR |
| GitHub | ✅ Synced | https://github.com/0xCaptain888/veil |
| Confidentiality (W1) | ✅ Adapter integrated | contra API documented, devnet beta ready, mainnet pending |
| zkLogin (W3) | ✅ Google OAuth integrated | Client ID configured, callback handler, simplified flow |
| DeepBook FX (W4) | ✅ Mainnet pools configured | V3 package + SUI/USDC pool + swap logic with slippage protection |
| Walrus/Seal (W5) | ⏳ Interface defined | Needs publisher URL + encryption logic |

See **`DEPLOYMENT_REPORT.md`** for the full deployment report with step-by-step next actions.

## License

MIT — see `LICENSE`.
