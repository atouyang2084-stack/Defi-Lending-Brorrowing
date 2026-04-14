# DeFi Lending Protocol - Usage Guide

This document is for users who just downloaded the repository and want to run it immediately.

## 1. Prerequisites

Make sure these are installed:

- Node.js 18+
- npm 9+
- MetaMask browser extension
- Git

Check versions:

```bash
node -v
npm -v
```

## 2. Quick Start (Recommended)

Open 3 terminals from project root.

### Terminal 1: Start local chain

```bash
npm run startnode
```

Keep this terminal running.

### Terminal 2: Deploy contracts and sync frontend ABI

```bash
npm run startnetwork
npm run transmit
```

This writes addresses into contract-addresses.json and copies ABI/address files to frontend.

### Terminal 3: Start frontend

```bash
cd frontend
npm install
npm run dev -- --host
```

Open browser:

- http://localhost:5173

## 3. First-Time Setup (If dependencies are missing)

From project root:

```bash
npm install
cd frontend
npm install
cd ..
```

Optional checks:

```bash
npm run compile
cd frontend
npm run build
```

## 4. MetaMask Configuration

Add local Hardhat network:

- Network Name: Localhost 8545
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency Symbol: ETH

Import test accounts from Terminal 1 output.

Recommended:

- Account #0 (admin/oracle price control)
- Account #1 (liquidator)
- Account #2 (borrower)

## 5. Basic Feature Flow

### Deposit

1. Go to USDC or WBTC market.
2. Enter amount.
3. Click Approve (first time only).
4. Click Deposit.

### Borrow

1. Deposit collateral first (usually WBTC).
2. Switch to Borrow tab.
3. Enter amount and confirm.

### Repay

1. Go to Repay tab.
2. Enter repay amount.
3. If allowance is insufficient, approve first.
4. Confirm repay.

### Withdraw

1. Go to Withdraw tab.
2. Enter amount.
3. Confirm transaction.

## 6. Liquidation Demo (No external script switching required)

Page:

- http://localhost:5173/liquidation

What is available in UI now:

- Price control panel (admin only)
- Multiple preset WBTC prices
- Custom WBTC price input
- Liquidatable borrower list (HF < 1)
- Borrower address copy button
- Borrower WBTC collateral amount display

### Suggested demo sequence

1. Connect with admin wallet (Account #0).
2. Lower WBTC price (for example 15000) from liquidation page.
3. Switch to liquidator wallet (Account #1).
4. Pick a target from the liquidatable list.
5. Click "Set as target" and execute liquidation.

## 7. Useful Scripts

From project root:

```bash
# Lower WBTC price to trigger liquidation scenario
node scripts/simulate-price-drop.js

# Restore WBTC price back to normal baseline
node scripts/restore-price.js
```

## 8. Troubleshooting

### Frontend cannot read on-chain state

- Confirm Terminal 1 is still running.
- Confirm MetaMask is on chain 31337.
- Confirm contracts were deployed in current chain session.
- Re-run:

```bash
npm run startnetwork
npm run transmit
```

### Transactions pop up but state does not change

- Wait for 1-2 blocks.
- Refresh page once.
- Check wallet has ETH for gas.
- Check token approval/allowance.

### Port conflict

Windows:

```bash
netstat -ano | findstr :8545
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

## 9. Reset and Restart Cleanly

1. Stop all terminals.
2. Start again in this order:

```bash
# terminal 1
npm run startnode

# terminal 2
npm run startnetwork
npm run transmit

# terminal 3
cd frontend
npm run dev -- --host
```

## 10. What to Upload to GitHub

Current repository policy keeps markdown minimal:

- Keep: README.md, USAGE.md
- Ignore: other markdown files

It also ignores build artifacts, logs, local env files, and temporary debug outputs so others can clone and run cleanly.
