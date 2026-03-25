# Contract Call Flow

## 1. Core Contract Graph

```mermaid
flowchart TD
  USER[User / Integrator] --> LP[LendingPool]

  LP --> ORA[ChainlinkOracleAdapter]
  LP --> RISK[RiskEngine]
  LP --> IR[InterestLogic (library)]
  LP --> LIQ[Liquidation Flow]
  LP --> FL[Flash Loan Flow]

  LP --> TOKA[(USDC)]
  LP --> TOKB[(WBTC)]
```

`LendingPool` 是统一入口；所有 `deposit/withdraw/borrow/repay/liquidate/flashLoan` 都先执行 `accrueInterest(asset)`，然后再做风控校验和资金转移。

---

## 2. Deposit / Withdraw

### Deposit

1. 用户调用 `deposit(asset, amount, onBehalfOf)`
2. `LendingPool` 调用 `accrueInterest(asset)` 更新索引
3. 把 `amount` 转换为 `supplyScaled = amount * RAY / supplyIndex`
4. 更新 `userSupplyScaled` 与 `totalSupplyScaled`
5. 转入 ERC20 资产

### Withdraw

1. 用户调用 `withdraw(asset, amount, to)`
2. `accrueInterest(asset)`
3. 先按当前指数减少用户 `supplyScaled`
4. 执行风控校验：`HF_after >= 1`
5. 转出 ERC20 资产给 `to`

---

## 3. Borrow / Repay

### Borrow

1. 用户调用 `borrow(asset, amount, onBehalfOf)`
2. `accrueInterest(asset)`
3. 风控校验：`LTV` 与 `HF_after >= 1`
4. 计算 `borrowScaled = amount * RAY / borrowIndex`
5. 更新 `userBorrowScaled` 与 `totalBorrowScaled`
6. 转出借款资产

### Repay

1. 用户调用 `repay(asset, amount, onBehalfOf)`
2. `accrueInterest(asset)`
3. 计算当前债务并确定实际还款额（不超过债务）
4. 减少 `userBorrowScaled` 与 `totalBorrowScaled`
5. 转入还款资产

---

## 4. Interest Accrual Model

采用课程简化版“利息池分成模型”：

- 借款指数增长（Borrow Index）
- 存款指数增长（Supply Index）
- 协议抽成（ReserveFactor）计入 `protocolReserves`

公式：

- `utilization = totalBorrows / totalSupplies`
- `supplyRate = borrowRate * utilization * (1 - reserveFactor)`
- `borrowIndex_{t+1} = borrowIndex_t * (1 + borrowRate * dt)`
- `supplyIndex_{t+1} = supplyIndex_t * (1 + supplyRate * dt)`

---

## 5. Liquidation

触发条件：`healthFactor(borrower) < 1`

1. 清算人调用 `liquidate(borrower, debtAsset, collateralAsset, repayAmount, minSeizeAmount)`
2. 对债务资产与抵押资产都执行 `accrueInterest`
3. 用预言机价格计算应扣押抵押数量（含 `liquidationBonus`）
4. 清算人支付 `debtAsset`
5. 借款人债务减少，抵押转给清算人

---

## 6. Flash Loan

1. 调用 `flashLoan(receiver, asset, amount, data)`
2. 记录 `balanceBefore`
3. 转出资产给 `receiver`
4. 回调 `receiver.onFlashLoan(...)`
5. 检查 `balanceAfter >= balanceBefore + fee`
6. 手续费计入 `protocolReserves`

---

## 7. Security Checklist

- `nonReentrant` 保护外部入口
- `checks-effects-interactions`
- 统一精度（`WAD/RAY/BPS`）
- 预言机过期与异常价格保护
- 对同资产抵押借款场景，统一按 `HF_after` 做最终约束
