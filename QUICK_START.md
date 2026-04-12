# 快速启动指南

## 第一步：启动本地测试网络

```bash
# 终端1：启动Hardhat节点
npm run startnode
# 或
npx hardhat node
```

## 第二步：部署智能合约

```bash
# 终端2：部署合约（在新终端中运行）
npm run startnetwork
# 或
npx hardhat run contracts/script/deploy.js --network localhost
```

## 第三步：启动前端应用

```bash
# 终端3：启动前端（在新终端中运行）
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 启动


## 第五步：连接钱包并开始测试

1. 打开浏览器访问 http://localhost:5173
2. 点击"Connect Wallet"连接钱包
3. 确保网络是"Localhost 8545" (chainId: 31337)
5. 开始测试存款、借款、还款功能


## 测试流程示例

### 1. 存款测试
1. 访问 http://localhost:5173/reserve/usdc
2. 输入存款金额（如 10,000 USDC）
3. 点击"Deposit"
4. 授权合约使用你的USDC
5. 确认交易

### 2. 借款测试
1. 访问 http://localhost:5173/reserve/wbtc
2. 输入借款金额（如 0.1 WBTC）
3. 点击"Borrow"
4. 确认交易

### 3. 还款测试
1. 在WBTC页面，输入还款金额
2. 点击"Repay"
3. 如果需要，先授权合约使用你的USDC
4. 确认交易

## 故障排除

### 常见问题1：合约未部署
```
错误: contract-addresses.json 文件不存在
```
**解决**：运行 `npm run startnetwork` 部署合约

### 常见问题2：余额不足
```
错误: insufficient funds for gas
```
**解决**：运行 `npm run faucet` 获取ETH

### 常见问题3：前端显示余额为0
**解决**：
1. 确认钱包已连接
2. 确认网络是localhost:8545
3. 刷新页面
4. 检查浏览器控制台

### 常见问题4：交易被拒绝
**解决**：
1. 检查MetaMask是否弹出确认窗口
2. 确认Gas费用设置
3. 检查网络拥堵情况

## 有用的命令

```bash
# 检查合约状态
npx hardhat run scripts/check-contracts.js --network localhost

# 检查你的授权状态
npx hardhat run scripts/check-your-auth.js --network localhost

# 简单测试存款
npx hardhat run scripts/test-deposit-simple.js --network localhost

# 简单测试还款
npx hardhat run scripts/test-repay-simple.js --network localhost
```

## 重置测试环境

如果需要完全重置：

```bash
# 1. 停止所有进程 (Ctrl+C)
# 2. 删除合约地址文件
rm contract-addresses.json

# 3. 重新开始
npm run startnode          # 终端1
npm run startnetwork       # 终端2
cd frontend && npm run dev # 终端3
npm run faucet             # 终端4（获取代币）
```

## 获取帮助

- 查看详细文档：`GET_TEST_TOKENS.md`
- 查看问题排查：`CHECKLIST.md`
- 检查浏览器控制台错误
- 查看终端输出信息