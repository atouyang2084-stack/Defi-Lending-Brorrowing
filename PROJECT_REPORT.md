# Project Report — Decentralized Lending & Borrowing Protocol

本报告内容覆盖：需求对齐、系统架构、核心算法、合约实现要点、安全性、测试与演示流程、可扩展性规划。

## 1. 项目概述

本项目实现一个最小可运行的去中心化借贷协议（DeFi Lending Protocol），支持多种 ERC-20 资产（示例：USDC/WBTC）的：

- **Deposit**：存入资产获取利息（随 Supply Index 增长）
- **Withdraw**：取回存款（需通过 HF/LTV 校验）
- **Borrow**：以抵押物为担保借出资产（受 LTV/Health Factor 约束）
- **Repay**：归还借款（随 Borrow Index 计息）
- **Liquidation**：当账户 **Health Factor < 1** 时，可由第三方触发清算

目标强调“课程项目可解释性与可扩展性”，采用 Aave/Compound 的关键思想（超额抵押 + 利率模型 + 指数计息），但避免引入过于复杂的生产级治理/多策略池等实现。

## 2. 需求对齐（Scope Mapping）

### 2.1 核心逻辑

- **ERC-20 支持**：USDC/WBTC 等资产作为借贷标的与抵押物
- **行为**：Deposit / Withdraw / Borrow / Repay

### 2.2 风控系统

- **超额抵押**：借款价值不得超过抵押价值的阈值
- **LTV（最大借款比例）**：限制可借上限
- **Health Factor（健康因子）**：实时衡量风险，低于 1 触发清算

### 2.3 利率模型与计息

- **Kinked Model（折点模型）**：利用率在 kink 前/后使用不同斜率
- **按区块累加（per block）**：通过指数（Index）累计利息，避免逐用户逐区块更新

### 2.4 预言机与清算

- **Chainlink 预言机**：生产场景可接入真实 price feed
- **本地演示**：使用 Mock aggregator 以便在 Hardhat 本地链可控地模拟价格波动
- **清算逻辑**：`HF < 1` 可清算（带 bonus）

### 2.5 Flash Loan（加分项）

合约接口中预留/实现了 flash loan 入口与回调验收思路，但课程演示优先级可根据时间调整（见“扩展规划”）。

## 3. 系统架构与模块划分

### 3.1 代码结构

见 `README.md` 与 `USAGE.md`。核心代码位于：

- `contracts/src/core/LendingPool.sol`
- `contracts/src/libraries/InterestLogic.sol`
- `contracts/src/oracle/ChainlinkOracleAdapter.sol`
- `contracts/src/risk/RiskEngine.sol`
- `contracts/src/interfaces/ILendingPool.sol`

### 3.2 模块职责

- **LendingPool（核心入口）**
  - 统一暴露外部接口（存取借还/清算/闪电贷）
  - 在关键操作前执行 `accrueInterest(asset)` 更新指数
  - 负责记账（scaled balances）与资产转移

- **InterestLogic（利率与指数）**
  - Kinked 模型计算借款利率（per block）
  - 由借款利率推导存款利率（utilization 与 reserveFactor 分成模型）
  - 更新 BorrowIndex / SupplyIndex

- **OracleAdapter（预言机适配）**
  - 读取 Chainlink/Mock 聚合器价格
  - 归一化到 `1e18`（WAD）
  - 过期保护（staleness）与异常价格保护

- **RiskEngine（风控计算）**
  - 资产数量与 USD 价值之间的转换
  - LTV 上限计算
  - Health Factor 计算（以 RAY 表示）

## 4. 核心算法与数据结构

### 4.1 指数计息（Index Accrual）

#### Borrow Index

借款人债务按指数增长：

\[
Debt = BorrowScaled \\times \\frac{BorrowIndex}{RAY}
\]

用户借款时写入：

\[
BorrowScaled += \\frac{Amount \\times RAY}{BorrowIndex}
\]

#### Supply Index

存款按指数增长：

\[
Supply = SupplyScaled \\times \\frac{SupplyIndex}{RAY}
\]

用户存入时写入：

\[
SupplyScaled += \\frac{Amount \\times RAY}{SupplyIndex}
\]

### 4.2 利率模型（Kinked Model）

利用率（WAD）：

\[
u = \\frac{TotalBorrows}{TotalSupplies}
\]

折点前后：

\[
r_b(u)=
\\begin{cases}
base + slope1 \\times \\frac{u}{kink}, & u \\le kink \\\\
base + slope1 + slope2 \\times \\frac{u-kink}{1-kink}, & u > kink
\\end{cases}
\]

年化转 per-block（通过 `blocksPerYear`）：

\[
r_{b,block} = \\frac{r_{b,year}}{blocksPerYear}
\]

### 4.3 存款利率分成模型（简化版）

存款利率来自借款利息，并考虑利用率与协议抽成：

\[
r_s = r_b \\times u \\times (1 - reserveFactor)
\]

- `reserveFactor`（协议抽成）默认建议 10%

### 4.4 健康因子（Health Factor）

以 USD 计价（WAD）：

- 抵押加权值：\(\sum collateralValue \\times liquidationThreshold\)
- 债务值：\(\sum debtValue\)

Health Factor（RAY）：

\[
HF = \\frac{WeightedCollateral}{Debt}
\]

当 `HF < 1`（即 `< RAY`）账户可被清算。

## 5. 关键流程（Call Flow）

### 5.1 Deposit

1. `accrueInterest(asset)`
2. `scaled = amount * RAY / supplyIndex`
3. 更新 `userSupplyScaled`、`totalSupplyScaled`
4. `transferFrom` 入金

### 5.2 Borrow

1. `accrueInterest(asset)`
2. 增加 `userBorrowScaled`
3. 校验 `LTV` 与 `HF_after >= 1`
4. `transfer` 出金

### 5.3 Withdraw

1. `accrueInterest(asset)`
2. 减少 `userSupplyScaled`
3. 校验 `HF_after >= 1`
4. `transfer` 出金

### 5.4 Repay

1. `accrueInterest(asset)`
2. 计算当前 debt，确定 `repaidAmount = min(amount, debt)`
3. 减少 `userBorrowScaled`
4. `transferFrom` 入金

### 5.5 Liquidation（概念流程）

1. 校验 `HF(borrower) < 1`
2. 清算人偿还部分债务（repay）
3. 按价格与 bonus 计算应扣押抵押物数量（seize）
4. 更新 borrower 的 debt 与 collateral
5. 抵押物转给清算人

## 6. 安全性与工程约束

### 6.1 安全清单（课程项目建议至少覆盖）

- **重入保护**：对外入口使用 `nonReentrant`
- **Checks-Effects-Interactions**：先更新状态，再转账
- **精度统一**：WAD(1e18)/RAY(1e27)/BPS(1e4)
- **预言机保护**
  - `answer <= 0` 拒绝
  - staleness 检查，拒绝过期价格
- **边界条件**
  - 无债务时 HF 视为极大
  - 无供应时 utilization = 0
  - 还款不应超过债务

### 6.2 为什么使用 scaled + index

- 避免逐用户逐区块更新（否则 gas 无法接受）
- 全局只需维护每个资产的 index 与 totalScaled
- 用户余额用 scaled 表示，查询时再按 index 还原

## 7. 测试与验证

### 7.1 测试位置

`contracts/test/` 中包含多份 Hardhat 测试与 mocks（例如 MockERC20、MockV3Aggregator 等），覆盖：

- 存取借还路径
- 利息指数累加与余额变化
- 触发健康因子下降的场景与清算

### 7.2 本地演示（推荐答辩脚本）

详见 `USAGE.md`：

- 启动本地链（Hardhat node）
- 部署合约并同步 ABI 到前端
- 前端页面演示：存款、借款、还款、降价触发清算、清算执行

## 8. 可扩展性规划

### 8.1 增加更多 ERC-20 资产

- 在配置层添加新资产 `AssetConfig`（LTV/阈值/bonus/priceFeed）
- 前端读取资产列表与展示

### 8.2 NFT 作为抵押品（未来工作）

建议引入统一 `CollateralKey`（kind + contract + tokenId）管理抵押仓位，并对 NFT 使用 floor/collection 预言机，风控计算仍可复用 `RiskEngine` 的“资产->USD”接口。

### 8.3 Flash Loan（加分项）

建议遵循 EIP-3156 风格：

1. 记录 `balanceBefore`
2. 转出资产到 receiver
3. 回调 `onFlashLoan`
4. 校验 `balanceAfter >= balanceBefore + fee`
5. fee 计入 `protocolReserves`

## 9. 结论

本项目在可控范围内实现了借贷协议的关键工程能力：风控、指数计息、预言机、清算演示与前端联调。结构上以模块划分保持清晰边界，便于团队并行开发与后续扩展（NFT 抵押、Flash Loan、更多资产等）。

