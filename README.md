# Decentralized Lending & Borrowing Protocol

大学课程项目：去中心化借贷协议（DeFi Lending & Borrowing Protocol）。支持 ERC-20 资产（USDC/WBTC）的存取款、借还款，并实现超额抵押、LTV、Health Factor、折点（Kinked）利率模型与清算演示。

## 1. 快速开始

先看并照做 `USAGE.md`（推荐）。它包含“3 个终端”一键跑起来的流程（本地链 + 部署 + 前端）。

## 2. 技术栈

- **Solidity**：Hardhat + ethers v6
- **Frontend**：React + Vite + Wagmi + Viem + RainbowKit + Tailwind
- **Oracle**：Chainlink Price Feed（本地演示使用 Mock 聚合器）

## 3. 目录结构（与当前代码一致）

```text
.
├── contracts
│   ├── src
│   │   ├── core            # LendingPool 主入口与状态管理
│   │   ├── interfaces      # ILendingPool 接口定义
│   │   ├── libraries       # 利率与指数（Index）等数学逻辑
│   │   ├── oracle          # Chainlink/Mock 预言机适配
│   │   └── risk            # LTV / Health Factor 计算与转换
│   ├── script              # Hardhat 部署脚本
│   └── test                # Hardhat 测试（含 mocks）
├── frontend                # DApp 前端（Vite）
├── scripts                 # 辅助脚本（复制 ABI / 模拟价格 / 铸币等）
├── contract-addresses.json # 部署后合约地址（本地链）
├── USAGE.md                # 运行指南
└── PROJECT_REPORT.md       # 详细项目报告（课程答辩版）
```

## 4. 协议核心实现概览

- **核心动作**：`Deposit` / `Withdraw` / `Borrow` / `Repay`
- **风控**：超额抵押、`LTV` 上限、`Health Factor`（HF）
- **利率**：Kinked Model；按区块通过 `BorrowIndex` / `SupplyIndex` 累加
- **清算**：`HF < 1` 时允许第三方清算（带清算奖励）

## 5. 前端功能状态（已实现）

- **Risk Management**
	- 超额抵押逻辑（借款受 LTV 与 HF 约束）
	- Health Factor 实时展示
	- LTV 限制在借款路径生效并展示
- **Interest Rate Model**
	- Reserve 页面新增 Interest Rate Model 卡片
	- 展示 Utilization、Borrow APR、Supply APR（实时）
	- 展示 Kinked 利率曲线（Borrow/Supply）与当前利用率位置
	- 展示 base/slope1/slope2/kink/reserve factor 等参数
- **Dashboard**
	- 展示用户抵押价值、债务价值、健康因子
	- 展示各资产 Supply/Borrow APY、Utilization、LTV、清算阈值

## 6. 常用命令

根目录：

```bash
npm install
npm run compile
```

前端：

```bash
cd frontend
npm install
npm run dev -- --host
```

## 7. 文档

- **运行方式**：`USAGE.md`
- **项目报告**：`PROJECT_REPORT.md`

## 8. Interest Model 参数来源说明

- 当前前端曲线使用默认参数（与部署脚本一致）：
	- `baseRatePerYearRay = 0`
	- `slope1PerYearRay = 0.04 * 1e27`
	- `slope2PerYearRay = 1.0 * 1e27`
	- `kinkWad = 0.8 * 1e18`
	- `blocksPerYear = 2628000`（部署）/前端按常量展示
- 前端实时点位和实时 APR 来源于链上读接口，因此会随池子状态变化而变化。
