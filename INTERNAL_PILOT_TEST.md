# Veil — Mainnet Pilot Test Report
**Internal Pilot · Sui Overflow 2026 Submission Evidence**
日期：2026-06-19

---

## 执行摘要

在 Sui **主网**上完成了一次完整的「发薪 → 托管 → 领取」全链路流程，涉及两个独立地址，全程链上可验证，无任何模拟数据。

---

## 合约信息

| 项目 | 值 |
|------|----|
| Package ID | `0x3d95e6f1a4ca7d8341c2d7bc054014cf53b099eb4686ca194b5b470d2d38921a` |
| 部署交易 | `9dvTzSVU6eHzSmdFVN4tLPjgUDDQ9ETo9YMwQZepD3ZD` |
| 网络 | Sui Mainnet |
| 模块 | `veil::payroll` |

---

## 参与地址

| 角色 | 地址 |
|------|------|
| 雇主（Employer） | `0xe8ba06981d5ff67259bb9ccb28b381d17ffe23160bf9c408f431a77a86603dc4` |
| 收款人（Recipient） | `0x89532691d455ab674b09579d5fb5ea591a28f328135108857808d2688c8f919b` |

---

## 交易 1 — 雇主发薪 PTB

**Transaction Digest：`Gyd66rCZbp44H26dzCbUm869zN6xtikxMFiHF89bhFPP`**

Explorer：https://suiscan.xyz/mainnet/tx/Gyd66rCZbp44H26dzCbUm869zN6xtikxMFiHF89bhFPP

### 一笔 PTB 完成的操作（原子执行）

| 步骤 | 操作 | 结果 |
|------|------|------|
| 1 | `SplitCoins` — 从 gas coin 分出 100,000,000 MIST (0.1 SUI) | ✅ |
| 2 | `MakeMoveVec<u8>` — 构造 keccak256(secret) 哈希向量 | ✅ |
| 3 | `create_run` — 创建发薪批次 | ✅ |
| 4 | `escrow_payout<SUI>` — 将 0.1 SUI 托管至共享 PayoutEscrow 对象 | ✅ |
| 5 | `finalize_run` — 完成批次，锁定状态 | ✅ |
| 6 | `TransferObjects` — PayrollRun 转回雇主地址 | ✅ |

### 链上事件（Events）

| 事件 | 关键字段 |
|------|----------|
| `RunCreated` | run: `0xd50d422a...7fb9`, employer: `0x08bee752...cf4a` |
| `PayoutEscrowed` | escrow: `0xc399d8fa...f611`, recipient_id_hash: `b5edDp...` |
| `RunFinalized` | run: `0xd50d422a...7fb9`, recipient_count: **1** |

### 创建的链上对象

| 对象 | 类型 | Owner |
|------|------|-------|
| `0xc399d8faa2d1e60a40e74eafe5694b4896b46d335fa88b363daa7479b0cdf611` | `PayoutEscrow<SUI>` | Shared (任何人可领取，需凭 secret) |
| `0xd50d422a333dd4aafa4bdf3ab62d45d3d5ac9480755dff946be0b314f7597fb9` | `PayrollRun` | 雇主地址 |

### Gas 消耗

- Storage Cost: 8,284,000 MIST
- Computation Cost: 100,000 MIST
- Storage Rebate: 4,318,776 MIST
- 雇主净支出：**−104,065,224 MIST**（含 0.1 SUI 薪资 + gas）

---

## 交易 2 — 收款人领取

**Transaction Digest：`5QJFEA9T2Ub8dUZrHJemjrMcC47tu94GMHCXQJfjfwYh`**

Explorer：https://suiscan.xyz/mainnet/tx/5QJFEA9T2Ub8dUZrHJemjrMcC47tu94GMHCXQJfjfwYh

### 执行的操作

收款人（地址2）调用 `claim_to_sender<SUI>`，传入：
- Escrow 对象：`0xc399d8faa2d1e60a40e74eafe5694b4896b46d335fa88b363daa7479b0cdf611`
- 一次性 claim secret（明文：`veil-pilot-2026-mainnet-v1`）

合约验证：`keccak256(proof_of_id) == recipient_id_hash` → 通过

### 链上事件

| 事件 | 关键字段 |
|------|----------|
| `PayoutClaimed` | escrow: `0xc399d8fa...f611`, **recipient: `0x89532691...919b`**, run: `0xd50d422a...7fb9` |

### 对象变更

| 变更 | 对象 | 说明 |
|------|------|------|
| Created | `0xb2151377...529a` — `Coin<SUI>` | **0.1 SUI 到账收款人地址** |
| Deleted | `0xc399d8fa...f611` — `PayoutEscrow<SUI>` | Escrow 已消费销毁，防止重复领取 |

### 余额变化

```
Owner: 0x89532691...919b (收款人)
CoinType: 0x2::sui::SUI
Amount: +101,099,128 MIST (≈ 0.101 SUI，含 storage rebate)
```

---

## 完整链路验证

```
部署合约
    ↓ 9dvTzSVU...D3ZD
雇主发薪 PTB (create_run + escrow_payout + finalize_run)
    ↓ Gyd66rCZ...hFPP
    → 事件: RunCreated / PayoutEscrowed / RunFinalized
    → 创建: PayoutEscrow<SUI> (Shared Object)
收款人领取 (claim_to_sender)
    ↓ 5QJFEA9T...wYh
    → 事件: PayoutClaimed { recipient: 0x8953... }
    → 创建: Coin<SUI> → 收款人地址
    → 销毁: PayoutEscrow (防双花)
```

**Status: Success ✅ — 全部链上可独立验证**

---

## Veil 核心设计验证点

| 设计特性 | 验证结果 |
|----------|----------|
| 金额不出现在任何链上事件 | ✅ PayoutEscrowed 事件只含 `recipient_id_hash`，无金额明文 |
| Escrow 为共享对象，支持跨地址领取 | ✅ 雇主创建，收款人（不同地址）成功领取 |
| keccak256 proof-of-id 防盗领 | ✅ 合约校验通过，secret 有效 |
| Escrow 领取后销毁，防重复领取 | ✅ `PayoutEscrow` 出现在 Deleted Objects |
| 全流程原子性（PTB） | ✅ 发薪 4 步在单笔交易内完成，要么全成功要么全回滚 |
| 两个独立地址，真实主网 | ✅ Epoch 1163，主网已确认 |

---

## Explorer 快速入口

| 链接 | 说明 |
|------|------|
| [合约对象](https://suiscan.xyz/mainnet/object/0x3d95e6f1a4ca7d8341c2d7bc054014cf53b099eb4686ca194b5b470d2d38921a) | Package 部署状态 |
| [发薪交易](https://suiscan.xyz/mainnet/tx/Gyd66rCZbp44H26dzCbUm869zN6xtikxMFiHF89bhFPP) | PTB 全流程 + 3个事件 |
| [领取交易](https://suiscan.xyz/mainnet/tx/5QJFEA9T2Ub8dUZrHJemjrMcC47tu94GMHCXQJfjfwYh) | PayoutClaimed 事件 + 到账记录 |
