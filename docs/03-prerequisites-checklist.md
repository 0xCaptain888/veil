# Veil — 准备资料清单(开发 / 部署前要备齐的信息)

这份清单告诉你:要跑通并部署 Veil,**需要准备哪些账号、钱包、密钥、ID**,以及**每个值最终填到哪个文件的哪个变量**。

分两档:
- **A 档 = 跑通基础 demo 的最小集**(保密/zkLogin/DeepBook 走回退,先把端到端 demo 演起来)。
- **B 档 = 升级集**(W1/W3/W4/W5 接入真实保密、邮箱登录、汇兑、加密薪资单)。

> 配套:安装与逐步部署见 `02-deployment-and-github-guide.md`;设计见 `01-development-document.md`。

---

## A 档 · 跑通基础 demo 的最小集

### 1. 本地工具
| 项 | 说明 | 怎么拿 |
|----|------|--------|
| Node.js ≥ 20 | 运行 relayer / web | nodejs.org 或 nvm |
| npm ≥ 10 | workspace 包管理 | 随 Node 附带 |
| Sui CLI(`sui`) | 构建/部署 Move、管理地址与密钥 | docs.sui.io 安装指引,或 `cargo install ... --bin sui` |
| Git | 推 GitHub | git-scm.com |

### 2. 雇主钱包(签名发薪交易)
| 项 | 说明 | 怎么拿 |
|----|------|--------|
| Sui 钱包浏览器插件 | 在雇主控制台连接、签名 | Sui Wallet / Slush 等 |
| 雇主地址 | 你的 Sui 地址(0x...) | 插件里复制,或 `sui client active-address` |
| Devnet 测试币 | 付 gas + 作为 demo 发薪资金 | `sui client faucet`,或插件的水龙头 |

### 3. Relayer 密钥(代付 gas + 执行领取)
| 项 | 说明 | 怎么拿 |
|----|------|--------|
| Relayer 私钥(`suiprivkey1...`) | relayer 用它签名并代付 gas | 见下方"如何获得 relayer 私钥" |
| Relayer 地址已领水 | 必须有 gas,否则领取会失败 | 用该地址 `sui client faucet` |

**如何获得 relayer 私钥:**
```bash
# 方式一:新建一个专用地址(推荐,避免用主地址)
sui client new-address ed25519                 # 记下生成的地址
sui keytool export --key-identity <该地址>      # 导出 suiprivkey1... 私钥串
# 然后给它领水:
sui client switch --address <该地址> && sui client faucet
sui client switch --address <雇主地址>          # 切回雇主地址做演示
```
> ⚠️ 这个私钥要填进 `.env` 的 `RELAYER_PRIVATE_KEY`。**它已被 `.gitignore` 排除,绝不要提交到 GitHub。** Devnet 测试币无价值,但养成不泄私钥的习惯。

### 4. 部署后才会拿到的 ID
| 项 | 说明 | 何时拿 |
|----|------|--------|
| **Package ID** | `sui client publish` 后的已发布包地址(0x...) | 部署成功后从输出复制(见 02 号文档第 3 步) |
| Employer object id / AdminCap id | 在雇主控制台点 "Register employer" 后自动生成并回填 | 运行 demo 时 |
| Funding Coin object id | 你拥有的一个 SUI coin 对象 id(余额 ≥ 发薪总额) | `sui client gas` / `sui client objects` 里挑一个 |

### 5. 稳定币类型(demo)
| 项 | 说明 |
|----|------|
| `STABLE_COIN_TYPE` | demo 用 **`0x2::sui::SUI`**(原生 SUI),无需自发代币即可演示 |

---

## B 档 · 升级集(接入真实能力)

### W1 · Confidential Transfers(真正的金额保密)
| 项 | 说明 | 来源 |
|----|------|------|
| 官方 beta 包 | 把 `confidential_adapter.move` / `confidential.ts` 接到它 | github.com/MystenLabs/confidential-transfers |
| 保密稳定币(发行方) | demo 内自发一个并开启"保密模式",同时用于演示审计解密 | 跟随 beta 文档铸造 |
| 雇主 / 收款人 / 审计 解密密钥 | 三类受限密钥(分层、可轮换) | 按 beta 的密钥模型生成 |

### W3 · zkLogin + Sponsored(邮箱登录、零 gas)
| 项 | env 变量 | 怎么拿 |
|----|----------|--------|
| Google OAuth Client ID | `GOOGLE_CLIENT_ID` / 前端 | Google Cloud Console 建 OAuth 2.0 凭据,配置回调地址 |
| zkLogin Prover 服务地址 | `ZKLOGIN_PROVER_URL` | 自建 prover 或用 Mysten 提供的 prover 服务 |
| Salt 服务地址 | `SALT_SERVICE_URL` | 自建 salt 服务(为用户派生稳定 salt) |

### W4 · DeepBook(即时跨币结算)
| 项 | env 变量 | 怎么拿 |
|----|----------|--------|
| DeepBook 包 ID | `DEEPBOOK_PACKAGE_ID` | DeepBook 官方部署地址(对应网络) |
| 目标交易对 Pool ID | `DEEPBOOK_POOL_ID` | 你要兑换的 `USDC→本币` 池子的对象 id |

### W5 · Walrus + Seal(加密薪资单)
| 项 | env 变量 | 怎么拿 |
|----|----------|--------|
| Walrus Publisher 地址 | `WALRUS_PUBLISHER_URL` | Walrus 公测/自建 publisher 端点 |
| Seal 访问策略 | (代码内配置) | 按 Seal 文档设定收款人 + 审计方可解锁 |

---

## env 映射总表(值 → 变量 → 文件)

| 你的值 | 变量 | 文件 | 档 |
|--------|------|------|----|
| Devnet | `SUI_NETWORK` / `NEXT_PUBLIC_SUI_NETWORK` | `.env` / `apps/web/.env.local` | A |
| Package ID | `VEIL_PACKAGE_ID` / `NEXT_PUBLIC_VEIL_PACKAGE_ID` | 同上 | A |
| relayer 私钥 | `RELAYER_PRIVATE_KEY` | `.env`(**勿提交**) | A |
| `0x2::sui::SUI` | `STABLE_COIN_TYPE` / `NEXT_PUBLIC_STABLE_COIN_TYPE` | 同上 | A |
| `8787` | `PORT` | `.env` | A |
| `http://localhost:3000` | `WEB_ORIGIN` | `.env` | A |
| `http://localhost:8787` | `NEXT_PUBLIC_RELAYER_URL` | `apps/web/.env.local` | A |
| Google Client ID | `GOOGLE_CLIENT_ID` | `.env` | B(W3) |
| Prover / Salt URL | `ZKLOGIN_PROVER_URL` / `SALT_SERVICE_URL` | `.env` | B(W3) |
| DeepBook 包 / 池 ID | `DEEPBOOK_PACKAGE_ID` / `DEEPBOOK_POOL_ID` | `.env` | B(W4) |
| Walrus Publisher URL | `WALRUS_PUBLISHER_URL` | `.env` | B(W5) |

---

## 上手顺序建议(最快看到 demo)

1. 装 Node + Sui CLI + 钱包插件(A-1、A-2)。
2. `sui client switch --env devnet` → `sui client faucet`(领水)。
3. 准备 relayer 私钥并领水(A-3)。
4. `sui move build/test` → `./scripts/publish.sh` 拿 Package ID(A-4)。
5. 填 `.env` + `apps/web/.env.local`(映射总表 A 档行)。
6. `npm run dev:relayer` + `npm run dev:web` → 跑通 demo(02 号文档第 6 步)。
7. 满意后再按 B 档逐步接入 W1/W3/W4/W5。

---

## 提交参赛前要备齐(对应 01 号文档附录 A)
- [ ] GitHub 仓库链接(已推送)
- [ ] 已部署合约的 **Package ID**
- [ ] 现场可跑 demo + **备份视频**
- [ ] 一段清晰的 "why Sui / why now"
- [ ] design partner / 牵引力证据(越早越好)
- [ ] 审计额度申请(OpenZeppelin / OtterSec,若赛事提供)
