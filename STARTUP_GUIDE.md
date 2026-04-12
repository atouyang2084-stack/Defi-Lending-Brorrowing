# 🚀 项目启动指南

本文档详细说明如何从零启动整个DeFi借贷协议项目。

## 📋 前置要求

1. **Node.js** (v18+)
2. **npm** 或 **yarn**
3. **MetaMask** 浏览器扩展
4. **Git** (可选)

## 🏗️ 第一步：安装依赖

### 1.1 安装项目依赖
```bash
# 在项目根目录
npm install
```

### 1.2 安装前端依赖
```bash
# 进入前端目录
cd frontend
npm install
cd ..
```

## 🔗 第二步：启动本地区块链

### 2.1 启动Hardhat节点
```bash
# 在项目根目录（终端1）
npx hardhat node
```
**注意**：保持这个终端运行，不要关闭。

### 2.2 部署智能合约
```bash
# 新开一个终端（终端2），在项目根目录
npx hardhat run contracts/script/deploy.js --network localhost
```

**部署成功会显示**：
- ✅ LendingPool部署成功
- ✅ 资产配置完成
- ✅ 给20个账号发币完成
- ✅ 合约地址保存到`contract-addresses.json`

### 2.3 复制ABI到前端
```bash
# 在终端2继续运行
npm run transmit
```

## 🌐 第三步：配置钱包

### 3.1 添加本地网络到MetaMask
1. 打开MetaMask
2. 点击网络选择器（顶部显示"Ethereum Mainnet"的地方）
3. 点击"添加网络"
4. 手动添加以下配置：

```
网络名称: Localhost 8545
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
货币符号: ETH
区块浏览器URL: (留空)
```

### 3.2 导入测试账户
1. 在Hardhat节点终端（终端1）中，复制第一个账户的私钥
2. 在MetaMask中点击账户图标 → "导入账户"
3. 粘贴私钥并导入

**测试账户示例**（前3个）：
```
账户0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
私钥: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

账户1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
私钥: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

账户2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
私钥: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

## 🖥️ 第四步：启动前端

### 4.1 启动开发服务器
```bash
# 新开一个终端（终端3），在项目根目录
cd frontend
npm run dev
```

### 4.2 访问前端
打开浏览器访问：**[http://localhost:5173](http://localhost:5173)**


## 🔧 第六步：使用协议

### 6.1 连接钱包
1. 访问 `http://localhost:5173`
2. 点击"Connect Wallet"按钮
3. 选择MetaMask并连接

### 6.2 存款（Deposit）
1. 点击"USDC Market"或"WBTC Market"
2. 输入存款金额
3. 点击"Deposit"
4. **第一次需要授权**：先点击"Approve"，然后再次点击"Deposit"

### 6.3 借款（Borrow）
1. 确保有足够的抵押品
2. 在资产页面选择"Borrow"
3. 输入借款金额
4. 点击"Borrow"

### 6.4 还款（Repay）
1. 在资产页面选择"Repay"
2. 输入还款金额
3. 点击"Repay"
4. **可能需要先授权**

## 🐛 常见问题解决

### ❌ 问题1：前端看不到资产
**解决方案**：
1. 检查钱包是否连接到"Localhost 8545"网络
2. 检查Chain ID是否为31337
3. 刷新页面或清除浏览器缓存

### ❌ 问题2：交易失败
**解决方案**：
1. 检查钱包是否有足够的ETH支付Gas
2. 检查代币授权是否足够（需要先点Approve）
3. 查看浏览器控制台错误信息（F12 → Console）

### ❌ 问题3：端口被占用
**解决方案**：
```bash
# 检查端口占用
netstat -ano | findstr :8545
netstat -ano | findstr :5173

# 杀死占用进程（Windows）
taskkill /PID 进程ID /F
```

### ❌ 问题4：合约地址不匹配
**解决方案**：
```bash
# 重新部署合约
npx hardhat run contracts/script/deploy.js --network localhost

# 更新前端ABI和地址
npm run transmit
```

## 📁 项目结构说明

```
项目根目录/
├── contracts/          # 智能合约
│   ├── src/           # 合约源代码
│   ├── test/          # 测试文件
│   └── script/        # 部署脚本
├── frontend/          # 前端应用
│   ├── src/           # React源代码
│   └── package.json   # 前端依赖
├── scripts/           # 实用脚本
├── hardhat.config.js  # Hardhat配置
└── package.json       # 项目依赖
```

## ⚡ 快速命令参考

| 命令 | 说明 | 运行位置 |
|------|------|----------|
| `npx hardhat node` | 启动本地区块链 | 项目根目录 |
| `npx hardhat run contracts/script/deploy.js --network localhost` | 部署合约 | 项目根目录 |
| `npm run transmit` | 复制ABI到前端 | 项目根目录 |
| `cd frontend && npm run dev` | 启动前端 | 前端目录 |
| `TARGET_ADDRESS=0x... npx hardhat run scripts/mint-to-any-account.js --network localhost` | 给账户发币 | 项目根目录 |

## 🔄 重启流程

如果需要重启整个系统：

1. **停止所有服务**：关闭所有终端
2. **启动节点**：`npx hardhat node`（终端1）
3. **部署合约**：`npx hardhat run contracts/script/deploy.js --network localhost`（终端2）
4. **复制ABI**：`npm run transmit`（终端2）
5. **启动前端**：`cd frontend && npm run dev`（终端3）

## 📞 获取帮助

如果遇到问题：
1. 检查浏览器控制台错误（F12）
2. 查看Hardhat节点日志
3. 确保所有步骤按顺序执行

---

**💡 提示**：保持3个终端分别运行：
- 终端1：Hardhat节点 (`npx hardhat node`)
- 终端2：用于部署和脚本命令
- 终端3：前端开发服务器 (`cd frontend && npm run dev`)

现在你可以开始使用DeFi借贷协议了！🎉