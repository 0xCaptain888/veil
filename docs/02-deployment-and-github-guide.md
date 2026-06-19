# Veil — 部署 & GitHub 指南

本指南带你把下载的代码压缩包,从**解压**一路走到**本地跑通 demo**,再到**推送上 GitHub**。命令可直接复制。

> 配套文档:`01-development-document.md`(完整设计)、`03-prerequisites-checklist.md`(需要准备的账号/密钥/地址)。
>
> **重要:** 代码在打包环境中**未联网编译**(那台机器没有网络)。它是按"可编译、可运行"标准写好并通过静态检查的;最终"绿灯编译"在**你的机器**上完成——本指南第 2–3 步就是做这件事。

---

## 0. 你需要先准备(详见 03 号文档)

- **Node.js ≥ 20**、**npm ≥ 10**
- **Sui CLI**(`sui`)
- 一个**Sui 钱包浏览器插件**(雇主签名用),如 Sui Wallet / Slush
- 一个**已领水的 relayer 私钥**(`suiprivkey1...` 格式)

---

## 1. 解压并安装依赖

```bash
unzip veil.zip          # 或用图形界面解压
cd veil

npm install             # 安装 workspace 全部依赖(packages/* 与 apps/*)
```

> 如果 `npm install` 因为 workspace 协议报错,确认 npm ≥ 10(`npm -v`)。

---

## 2. 安装 Sui CLI 并准备地址

安装(若尚未安装),二选一:

```bash
# 方式 A:从 release 下载预编译(按系统选择)
#   见 https://docs.sui.io/guides/developer/getting-started/sui-install

# 方式 B:用 cargo 源码安装
cargo install --locked --git https://github.com/MystenLabs/sui.git --bin sui
```

切到 Devnet 并领水:

```bash
sui client switch --env devnet      # 没有 env 时按提示 new-env: rpc https://fullnode.devnet.sui.io:443
sui client active-address           # 记下你的雇主地址
sui client faucet                   # 领测试币
sui client gas                      # 确认有 gas
```

---

## 3. 构建并部署 Move 包(拿到 Package ID)

```bash
# 先单独构建 + 跑测试(本地绿灯)
sui move build --path move/veil
sui move test  --path move/veil

# 部署
./scripts/publish.sh                # 等价于 sui client publish --gas-budget ... move/veil
```

发布成功后,在输出的 **Published Objects** 段里找到 **PackageID**(形如 `0x....`),**复制备用**。

> 关于 Move 导入:edition 2024 会**隐式导入** `object`/`ID`/`UID`/`transfer`/`tx_context`,本仓库已据此**省略**这些 `use` 行(这是为避免 duplicate alias 主动做的修复)。极少数老工具链若报 **unbound module/type**,把这三行加回 `move/veil/sources/payroll.move` 顶部即可:`use sui::object::{Self, ID, UID};`、`use sui::tx_context::{Self, TxContext};`、`use sui::transfer;`(必要时给 `confidential_adapter.move` 加回 `use sui::tx_context::TxContext;`)。
>
> 若报**依赖解析失败**:把 `move/veil/Move.toml` 里的 `rev = "framework/testnet"` 改成与你 `sui` 版本匹配的分支(例如 `framework/devnet`),再构建。

---

## 4. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`,至少填:

| 变量 | 填什么 |
|------|--------|
| `VEIL_PACKAGE_ID` | 第 3 步拿到的 PackageID |
| `NEXT_PUBLIC_VEIL_PACKAGE_ID` | 同上(前端用) |
| `RELAYER_PRIVATE_KEY` | 一个**已领水**的 `suiprivkey1...` 私钥(可 `sui keytool export --key-identity <addr>` 或新建一个并领水) |
| `STABLE_COIN_TYPE` / `NEXT_PUBLIC_STABLE_COIN_TYPE` | demo 保持 `0x2::sui::SUI` 即可 |

前端读取 `NEXT_PUBLIC_*`。本地开发时,建议把这几个 `NEXT_PUBLIC_*` 同时放一份到 `apps/web/.env.local`:

```bash
cat > apps/web/.env.local << 'EOF'
NEXT_PUBLIC_SUI_NETWORK=devnet
NEXT_PUBLIC_VEIL_PACKAGE_ID=0x<你的PackageID>
NEXT_PUBLIC_STABLE_COIN_TYPE=0x2::sui::SUI
NEXT_PUBLIC_RELAYER_URL=http://localhost:8787
EOF
```

> **安全:** `.env` / `.env.local` 已被 `.gitignore` 排除。**永远不要提交真实私钥。**

---

## 5. 运行(两个终端)

```bash
# 终端 A:relayer(gas station + 审计 API)
npm run dev:relayer        # → http://localhost:8787  (访问 /health 应返回 packageId)

# 终端 B:前端
npm run dev:web            # → http://localhost:3000
```

---

## 6. 跑通 Demo

1. 打开 **http://localhost:3000/employer**:
   - 点 **Connect** 连上你的钱包(Devnet)。
   - 点 **Register employer** → 页面自动填好 Employer/AdminCap id。
   - 拿一个你拥有的 **SUI coin 对象 id** 填入 **Funding Coin**(可 `sui client gas` 或 `sui client objects` 查看;选一个余额够的)。
   - 编辑收款人(邮箱 + 金额,金额是基础单位)。
   - 点 **Execute confidential payout**。成功后页面显示每个收款人的 **claim 链接**,并打印 **Run id**。
2. 打开任一 **claim 链接**(或在收款人浏览器里):连钱包(生产为 Google/zkLogin)→ **Receive payment**。relayer 代付 gas,资金到账。
3. 打开 **http://localhost:3000/audit**:粘贴 **Run id** → **Load** → 查看对账 → **Export CSV**。

> 演示口播弧线见 `01-development-document.md` §22。建议**录一份备份视频**以防 Devnet 抽风。

---

## 7. 推送到 GitHub

在 GitHub 先建一个**空仓库**(不要勾选自动生成 README),名为 `veil`,然后:

```bash
cd veil
git init
git add .
git commit -m "Veil — confidential payroll on Sui (Overflow 2026)"
git branch -M main
git remote add origin https://github.com/<你的用户名>/veil.git
git push -u origin main
```

推送前自检:

```bash
git status --ignored        # 确认 .env / node_modules 在 ignored 里,未被加入
```

> 若你用 SSH:`git remote add origin git@github.com:<你>/veil.git`。
>
> 提交参赛时,把 **GitHub 仓库链接** + **PackageID** + **demo 视频** 一起提交;`docs/01` 的附录 A 是提交清单。

---

## 8. 故障排查

| 现象 | 处理 |
|------|------|
| `sui move build` 报 unbound module/type(`object`/`ID`/`transfer`…) | 老工具链无隐式导入:把 `use sui::object::{Self, ID, UID};`/`use sui::tx_context::{Self, TxContext};`/`use sui::transfer;` 三行加回 `payroll.move` 顶部 |
| 依赖解析失败 | 改 `Move.toml` 的 `rev` 到匹配分支(`framework/devnet` 等) |
| relayer `/health` 返回 packageId=unset | `.env` 未填 `VEIL_PACKAGE_ID`,或未在 relayer 终端加载 |
| 领取 500 | `RELAYER_PRIVATE_KEY` 未设或未领水;`VEIL_PACKAGE_ID` 不对 |
| 前端连不上 relayer / CORS | relayer 的 `WEB_ORIGIN` 要等于前端地址;前端 `NEXT_PUBLIC_RELAYER_URL` 指向 relayer |
| 执行 run 报 coin 不足 | Funding Coin 余额要 ≥ 所有收款人金额之和 |
| BigInt 报错 | 金额用基础单位(字符串),代码内用 `BigInt()` 转换 |

---

## 9. 进一步(W1–W5 接入点)

- **W1 保密金额:** 把 `move/veil/sources/confidential_adapter.move` 的 `withdraw_for_payout` 与 `packages/sdk/src/confidential.ts` 接到官方 beta(github.com/MystenLabs/confidential-transfers)。
- **W3 zkLogin + sponsored:** 填 `GOOGLE_CLIENT_ID`/`ZKLOGIN_PROVER_URL`/`SALT_SERVICE_URL`,把领取改为收款人 zkLogin 签名 + relayer 仅 sponsor gas。
- **W4 DeepBook:** 填 `DEEPBOOK_PACKAGE_ID`/`DEEPBOOK_POOL_ID`,在 `packages/sdk/src/deepbook.ts` 的 `maybeSwap` 接入兑换。
- **W5 Walrus/Seal:** 填 `WALRUS_PUBLISHER_URL`,把薪资单加密存储接上。

各接入点在代码里都有 `W1`/`W3`/`W4`/`W5` 注释标记。
