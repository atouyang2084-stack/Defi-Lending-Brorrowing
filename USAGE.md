# 🚀 DeFi借贷协议 - 完整使用指南

## 📋 目录
1. [环境要求](#环境要求)
2. [安装依赖](#安装依赖)
3. [启动本地区块链](#启动本地区块链)
4. [部署智能合约](#部署智能合约)
5. [启动前端应用](#启动前端应用)
6. [配置钱包](#配置钱包)
7. [获取测试代币](#获取测试代币)
8. [使用协议功能](#使用协议功能)
9. [故障排除](#故障排除)
10. [项目结构](#项目结构)

---

## 1. 🛠️ 环境要求

### 必需软件
- **Node.js** (v18 或更高版本)
- **npm** 或 **yarn** 包管理器
- **MetaMask** 浏览器扩展
- **Git** (可选，用于版本控制)

### 推荐浏览器
- Google Chrome (推荐)
- Mozilla Firefox
- Brave

### 系统要求
- 至少 4GB RAM
- 至少 2GB 可用磁盘空间
- 稳定的网络连接

---

## 2. 📦 安装依赖

### 2.1 克隆项目（如果从GitHub下载）
```bash
git clone <项目地址>
cd Defi-Lending-Brorrowing
```

### 2.2 安装项目依赖
```bash
# 安装Hardhat和合约依赖
npm install
```

### 2.3 安装前端依赖
```bash
# 进入前端目录
cd frontend
npm install
cd ..
```

**安装时间**：约3-5分钟，取决于网络速度。

---

## 3. ⛓️ 启动本地区块链

### 3.1 启动Hardhat节点
```bash
# 在项目根目录运行（终端1）
npx hardhat node
```

**成功提示**：
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts:
=========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

**重要**：保持这个终端运行，不要关闭！

---

## 4. 📝 部署智能合约

### 4.1 部署合约到本地网络
```bash
# 新开一个终端（终端2），在项目根目录运行
npx hardhat run contracts/script/deploy.js --network localhost
```

**部署过程**：
```
正在使用账户部署合约: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
LendingPool 部署成功，地址: 0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154
资产配置完成！
已给 20 个账号发币：每个 100000.0 USDC + 1.0 WBTC
合约地址已保存到 contract-addresses.json
```

### 4.2 复制ABI到前端
```bash
# 在同一个终端继续运行
npm run transmit
```

**输出**：
```
Copying LendingPool ABI...
Copying ERC20 ABI...
Copying ChainlinkFeed ABI...
Copying contract addresses...
ABI files and contract addresses copied successfully!
```

---

## 5. 🖥️ 启动前端应用

### 5.1 启动开发服务器
```bash
# 新开一个终端（终端3），在项目根目录运行
cd frontend
npm run dev
```

**成功提示**：
```
  VITE v4.5.0  ready in 321 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

### 5.2 访问前端
打开浏览器访问：**[http://localhost:5173](http://localhost:5173)**

---

## 6. 👛 配置钱包

### 6.1 添加本地网络到MetaMask

1. 打开MetaMask浏览器扩展
2. 点击网络选择器（顶部显示当前网络的地方）
3. 点击"添加网络"
4. 点击"手动添加网络"
5. 填写以下信息：

```
网络名称: Localhost 8545
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
货币符号: ETH
区块浏览器URL: (留空)
```

6. 点击"保存"

### 6.2 导入测试账户

1. 在Hardhat节点终端（终端1）中，复制一个账户的私钥
2. 在MetaMask中点击账户图标 → "导入账户"
3. 粘贴私钥
4. 点击"导入"

**推荐使用前3个账户**：
- 账户0: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- 账户1: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- 账户2: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

### 6.3 连接钱包到前端

1. 访问 `http://localhost:5173`
2. 点击"Connect Wallet"按钮
3. 选择MetaMask
4. 在MetaMask中点击"连接"或"下一步"
5. 选择账户并确认

**成功标志**：前端显示你的钱包地址，而不是"Connect Wallet"按钮。

---

## 7. 💰 获取测试代币

### 7.1 自动获取（前20个账户）

如果你使用Hardhat节点的前20个账户之一，部署时已经自动获得了：
- **100,000 USDC** (稳定币)
- **1 WBTC** (波动性资产)
- **10 ETH** (用于支付Gas费)

### 7.2 手动获取（其他账户）

```bash
# 在项目根目录运行（新终端）
TARGET_ADDRESS=你的钱包地址 npx hardhat run scripts/mint-to-any-account.js --network localhost
```

**示例**：
```bash
TARGET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e90F1b6c1a3 npx hardhat run scripts/mint-to-any-account.js --network localhost
```

### 7.3 使用水龙头脚本

```bash
# 交互式获取
npm run faucet
# 然后按照提示输入钱包地址
```

---

## 8. 📊 使用协议功能

### 8.1 查看仪表板

访问 `http://localhost:5173`，你可以看到：
- **健康因子** (Health Factor)
- **抵押品价值**
- **债务价值**
- **USDC市场**和**WBTC市场**卡片

### 8.2 存款 (Deposit)

1. 点击"USDC Market"或"WBTC Market"卡片
2. 输入存款金额
3. 点击"Deposit"按钮
4. **第一次需要授权**：
   - 先点击"Approve"按钮授权合约使用你的代币
   - 在MetaMask中确认交易
   - 授权成功后，再次点击"Deposit"
5. 在MetaMask中确认存款交易

**示例**：存入100 USDC
- 在USDC页面输入 `100`
- 点击"Deposit"
- 授权（如果需要）
- 确认交易

### 8.3 借款 (Borrow)

**前提**：需要有足够的抵押品

1. 在资产页面选择"Borrow"选项卡
2. 输入借款金额
3. 点击"Borrow"按钮
4. 在MetaMask中确认交易

**注意**：借款会增加你的债务，降低健康因子。

### 8.4 还款 (Repay)

1. 在资产页面选择"Repay"选项卡
2. 输入还款金额
3. 点击"Repay"按钮
4. **可能需要先授权**代币给合约
5. 在MetaMask中确认交易

### 8.5 提款 (Withdraw)

**前提**：有存款余额且健康因子安全

1. 在资产页面选择"Withdraw"选项卡
2. 输入提款金额
3. 点击"Withdraw"按钮
4. 在MetaMask中确认交易

---

## 9. 🐛 故障排除

### 9.1 常见问题

#### ❌ 问题：前端看不到资产
**解决方案**：
1. 检查钱包是否连接到"Localhost 8545"网络
2. 检查Chain ID是否为31337
3. 刷新页面 (Ctrl+F5)
4. 清除浏览器缓存

#### ❌ 问题：点击按钮MetaMask没反应
**解决方案**：
1. 按F12打开浏览器控制台
2. 查看是否有红色错误
3. 检查钱包是否已连接
4. 检查网络是否正确

#### ❌ 问题：交易失败
**解决方案**：
1. 检查ETH余额是否足够支付Gas
2. 检查代币授权是否足够（需要先点Approve）
3. 查看MetaMask错误信息

#### ❌ 问题：端口被占用
**解决方案**：
```bash
# 检查端口占用
netstat -ano | findstr :8545
netstat -ano | findstr :5173

# 杀死占用进程（Windows）
taskkill /PID <进程ID> /F
```

### 9.2 浏览器控制台检查

按 **F12** 打开开发者工具，检查：
1. **Console标签页**：是否有红色错误
2. **Network标签页**：请求是否成功
3. **Application标签页**：清除缓存（如有需要）

### 9.3 完整重启步骤

如果遇到无法解决的问题：

```bash
# 1. 关闭所有终端
# 2. 启动Hardhat节点（终端1）
npx hardhat node

# 3. 部署合约（终端2）
npx hardhat run contracts/script/deploy.js --network localhost
npm run transmit

# 4. 启动前端（终端3）
cd frontend
npm run dev

# 5. 重新连接钱包
```

---

## 10. 📁 项目结构

### 10.1 核心目录

```
Defi-Lending-Brorrowing/
├── contracts/           # 智能合约
│   ├── src/            # 合约源代码
│   ├── test/           # 测试文件
│   └── script/         # 部署脚本
├── frontend/           # 前端应用
│   ├── src/            # React源代码
│   ├── public/         # 静态资源
│   └── 配置文件        # 构建配置
├── scripts/            # 实用脚本
└── 文档文件            # 使用指南和说明
```

### 10.2 重要文件说明

| 文件 | 用途 | 重要性 |
|------|------|--------|
| `contracts/script/deploy.js` | 一键部署合约 | ⭐⭐⭐⭐⭐ |
| `frontend/src/hooks/useDeposit.ts` | 存款功能 | ⭐⭐⭐⭐⭐ |
| `scripts/copy-abi.js` | 复制ABI到前端 | ⭐⭐⭐⭐ |
| `hardhat.config.js` | Hardhat配置 | ⭐⭐⭐⭐ |
| `contract-addresses.json` | 合约地址 | ⭐⭐⭐ |

### 10.3 命令参考

| 命令 | 用途 | 运行位置 |
|------|------|----------|
| `npx hardhat node` | 启动本地区块链 | 项目根目录 |
| `npx hardhat run contracts/script/deploy.js --network localhost` | 部署合约 | 项目根目录 |
| `npm run transmit` | 复制ABI到前端 | 项目根目录 |
| `cd frontend && npm run dev` | 启动前端 | 前端目录 |
| `TARGET_ADDRESS=0x... npx hardhat run scripts/mint-to-any-account.js --network localhost` | 获取测试代币 | 项目根目录 |

---

## 🎯 快速开始（3终端法）

### 终端1：启动区块链
```bash
npx hardhat node
```

### 终端2：部署合约
```bash
npx hardhat run contracts/script/deploy.js --network localhost
npm run transmit
```

### 终端3：启动前端
```bash
cd frontend
npm run dev
```

### 浏览器：使用协议
1. 访问 `http://localhost:5173`
2. 连接钱包（MetaMask）
3. 开始存款、借款、还款

---

## 📞 获取帮助

如果遇到问题：

1. **查看详细文档**：
   - `STARTUP_GUIDE.md` - 详细启动指南
   - `FIX_METAMASK_ISSUE.md` - MetaMask问题修复
   - `QUICK_START.md` - 快速开始

2. **检查浏览器控制台** (F12 → Console)

3. **查看终端输出**，寻找错误信息

4. **确保所有服务正常运行**：
   - Hardhat节点（端口8545）
   - 前端开发服务器（端口5173）

5. **按照步骤顺序执行**，不要跳过任何步骤

---

## 🎉 开始使用！

现在你已经准备好使用DeFi借贷协议了。从存款开始，体验完整的借贷流程：

1. **存款** → 获得利息收入
2. **借款** → 使用抵押品借款
3. **还款** → 减少债务
4. **提款** → 取回存款

祝你使用愉快！🚀