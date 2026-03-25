# Decentralized Lending & Borrowing Protocol

一个用于大学课程项目的去中心化借贷协议模板，支持 ERC-20 资产（如 USDC/WBTC）的存取款、借还款，并包含超额抵押、LTV、Health Factor、Kinked 利率模型、清算与 Flash Loan 的扩展能力。

## 1. 项目目标

- 支持核心动作：`Deposit`、`Withdraw`、`Borrow`、`Repay`
- 风控系统：超额抵押 + `LTV` + `Health Factor`
- 利率模型：`Kinked Model`，按区块通过 `Index` 累加
- 预言机：集成 Chainlink
- 加分能力：第三方清算（`HF < 1`）与 Flash Loan 接口
- 代码结构：模块化、可扩展，方便 4 人协作开发

## 2. 技术栈

- Solidity + Foundry（推荐）/ Hardhat（二选一或同时保留）
- React + Vite
- Wagmi + Viem
- Chainlink Price Feed

## 3. 目录结构

```text
.
├── contracts
│   ├── src
│   │   ├── core            # LendingPool 主入口与状态管理
│   │   ├── interfaces      # ILendingPool 等接口定义
│   │   ├── libraries       # 数学库、精度处理、Index 更新逻辑
│   │   ├── oracle          # Chainlink 适配层
│   │   ├── risk            # LTV / Health Factor 校验
│   │   ├── liquidation     # 清算逻辑
│   │   └── flashloan       # Flash Loan 模块
│   ├── script              # 部署脚本
│   └── test                # 合约测试
├── frontend
│   ├── public
│   └── src
│       ├── components      # UI 组件
│       ├── pages           # 页面
│       ├── hooks           # Wagmi/Viem 交互 hooks
│       └── lib             # ABI、地址、工具函数
└── docs
    ├── architecture        # 架构图与调用关系说明
    ├── specs               # 协议规格（参数、公式、边界条件）
    └── api                 # 前端与合约交互 API 文档
```

## 4. 智能合约模块职责建议

- `core/LendingPool.sol`
  - 对外统一入口：deposit/withdraw/borrow/repay/liquidate/flashLoan
  - 在所有关键动作前调用 `accrueInterest(asset)` 更新指数
- `interfaces/ILendingPool.sol`
  - 对外接口、事件、错误、结构体定义
- `libraries/InterestLogic.sol`
  - `borrowIndex/supplyIndex` 的按区块累加
  - 计算 `utilization`、`borrowRate`、`supplyRate`
- `oracle/ChainlinkOracleAdapter.sol`
  - 价格读取、decimals 归一化、过期价格保护
- `risk/RiskEngine.sol`
  - LTV 上限、Health Factor 计算与校验
- `liquidation/LiquidationEngine.sol`
  - 当 `HF < 1` 允许第三方清算，计算可偿还债务和可扣抵押
- `flashloan/FlashLoanProvider.sol`
  - 闪电贷发放、回调、手续费与归还校验

## 5. 利率与指数（课程项目简化版）

### 5.1 Borrow Index

借款人债务按指数增长：

- `userDebt = userBorrowScaled * currentBorrowIndex / RAY`
- `borrowIndex` 每次交互按区块更新

### 5.2 Supply Index

存款收益来源于借款利息分成：

- `SupplyAPY = BorrowAPY * Utilization * (1 - ReserveFactor)`
- 建议 `ReserveFactor = 10%`

### 5.3 Kinked 利率模型

- 利用率低于 `kink`：缓慢增长（`slope1`）
- 超过 `kink`：快速增长（`slope2`）

## 6. 风险控制

- 借款前：`HF_after >= 1`
- 赎回前：`HF_after >= 1`
- 价格校验：拒绝无效/过期喂价
- 安全：
  - 使用 `ReentrancyGuard`
  - 使用 `SafeERC20`
  - 明确 `WAD/RAY/BPS` 精度转换
  - 尽量先更新状态后转账（或严格遵循 checks-effects-interactions）

## 7. 团队协作分工建议（4 人）

- A：核心池 + 存取借还（`core`）
- B：利率与指数（`libraries`）
- C：预言机 + 风控 + 清算（`oracle/risk/liquidation`）
- D：前端 DApp + 合约联调（`frontend`）

## 8. 里程碑

1. **M1**：完成 `ILendingPool`、存取款、借还款最小闭环
2. **M2**：接入 `Kinked` + `Index` 累加 + 单元测试
3. **M3**：接入 Chainlink + HF + 清算
4. **M4**：接入 Flash Loan + 前端展示 + 演示脚本

## 9. 本地开发建议

### 合约

1. 进入 `contracts/`
2. 初始化 Foundry 或 Hardhat
3. 补齐：
   - `src/interfaces/ILendingPool.sol`
   - `src/core/LendingPool.sol`
   - `test/` 测试用例（重点覆盖 HF 与清算边界）

### 前端

1. 进入 `frontend/`
2. 使用 Vite 初始化 React 项目
3. 配置 Wagmi + Viem
4. 接入合约 ABI 与地址，完成存取借还与风险面板

## 10. 演示清单（答辩建议）

- 用户存入 USDC 并借出 WBTC
- 市场波动导致 `HF` 下降
- 第三方触发清算
- 展示池子收入、协议抽成与存款收益变化
- 可选：执行一次 Flash Loan 并验证归还

---

如果你愿意，下一步我可以继续在该目录中直接生成：

- `contracts/src/interfaces/ILendingPool.sol`（完整接口）
- `contracts/src/libraries/InterestLogic.sol`（含 Kinked + Index 公式骨架）
- `docs/architecture/contract-call-flow.md`（合约调用关系图）
