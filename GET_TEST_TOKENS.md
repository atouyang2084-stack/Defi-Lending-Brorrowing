# 获取测试代币指南

本文档详细说明新账户如何获取USDC和WBTC测试代币。

## 方法一：前端水龙头（推荐）

1. **访问Dashboard页面**
   - 打开前端应用（通常是 http://localhost:5173）
   - 连接你的钱包

2. **使用水龙头组件**
   - 在Dashboard页面顶部会看到"获取测试代币（水龙头）"卡片
   - 点击"获取测试代币"按钮
   - 或者点击"复制脚本命令"按钮

3. **运行脚本命令**
   - 打开终端
   - 粘贴复制的命令
   - 按回车执行

## 方法二：手动运行脚本

### 步骤1：确保环境就绪
```bash
# 1. 确保在项目根目录
cd "D:\sem2\comp 5568\project_new\Defi-Lending-Brorrowing"

# 2. 确保Hardhat本地节点正在运行
# 如果未运行，启动节点：
npx hardhat node
```

### 步骤2：使用环境变量方式（推荐）
```bash
# 设置你的钱包地址
export TARGET_ADDRESS=0x你的钱包地址

# 运行脚本（自动发送ETH + USDC + WBTC）
npx hardhat run scripts/mint-to-any-account.js --network localhost
```

### 步骤3：修改脚本方式
```bash
# 1. 编辑 scripts/mint-to-account.js
# 将第17行改为你的钱包地址
const yourAddress = "0x你的钱包地址";

# 2. 运行脚本获取USDC和WBTC
npx hardhat run scripts/mint-to-account.js --network localhost

# 3. 编辑 scripts/send-eth.js
# 将第9行改为你的钱包地址
const toAddress = "0x你的钱包地址";

# 4. 运行脚本获取ETH作为Gas费
npx hardhat run scripts/send-eth.js --network localhost
```

## 方法三：重新部署合约（重置环境）

如果你需要完全重置测试环境：

```bash
# 1. 停止当前节点（如果正在运行）
# 按 Ctrl+C

# 2. 清理旧合约
rm contract-addresses.json

# 3. 启动新节点（在新终端）
npx hardhat node

# 4. 部署合约（在另一个终端）
npx hardhat run contracts/script/deploy.js --network localhost

# 5. 更新前端合约地址
# 部署脚本会自动更新 contract-addresses.json
# 前端会自动读取这个文件
```

## 获取的代币数量

每个新账户可以获得：
- **10 ETH** - 作为Gas费用
- **100,000 USDC** - 稳定币，6位小数
- **1 WBTC** - 波动性资产，8位小数

## 验证余额

### 在前端验证
1. 连接钱包后，Dashboard页面会显示：
   - 健康因子
   - 抵押品价值
   - 债务价值

2. 访问Reserve页面：
   - `/reserve/usdc` - 查看USDC市场
   - `/reserve/wbtc` - 查看WBTC市场
   - 页面会显示你的余额

### 在控制台验证
```bash
# 使用Hardhat控制台检查余额
npx hardhat console --network localhost

# 在控制台中：
> const addresses = require("./contract-addresses.json")
> const MockERC20 = await ethers.getContractFactory("MockERC20")
> const usdc = MockERC20.attach(addresses.USDC)
> const wbtc = MockERC20.attach(addresses.WBTC)
> const yourAddress = "0x你的钱包地址"
> await usdc.balanceOf(yourAddress)
> await wbtc.balanceOf(yourAddress)
> await ethers.provider.getBalance(yourAddress)
```

## 常见问题

### Q1: 脚本运行失败，显示"合约地址不存在"
**原因**: `contract-addresses.json` 文件不存在或格式错误
**解决**: 重新部署合约
```bash
npx hardhat run contracts/script/deploy.js --network localhost
```

### Q2: 交易失败，显示"insufficient funds for gas"
**原因**: 没有足够的ETH支付Gas费
**解决**: 获取ETH
```bash
# 方法A: 使用完整脚本
TARGET_ADDRESS=0x你的地址 npx hardhat run scripts/mint-to-any-account.js --network localhost

# 方法B: 只发送ETH
npx hardhat run scripts/send-eth.js --network localhost
```

### Q3: 前端显示余额为0
**原因**: 
1. 钱包未连接
2. 连接了错误的网络（应该是localhost:8545）
3. 合约地址未更新

**解决**:
1. 确认钱包已连接
2. 确认网络是localhost (chainId: 31337)
3. 刷新页面
4. 检查浏览器控制台是否有错误

### Q4: 水龙头按钮点击无反应
**原因**: 前端水龙头需要后端支持
**解决**: 使用脚本方式获取代币

## 高级：创建水龙头合约

如果你想要更完善的解决方案，可以创建一个专门的水龙头合约：

```solidity
// contracts/src/Faucet.sol
contract Faucet {
    IERC20 public usdc;
    IERC20 public wbtc;
    address public owner;
    mapping(address => bool) public hasClaimed;
    
    constructor(address _usdc, address _wbtc) {
        usdc = IERC20(_usdc);
        wbtc = IERC20(_wbtc);
        owner = msg.sender;
    }
    
    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(usdc.balanceOf(address(this)) >= 100000e6, "Insufficient USDC");
        require(wbtc.balanceOf(address(this)) >= 1e8, "Insufficient WBTC");
        
        hasClaimed[msg.sender] = true;
        usdc.transfer(msg.sender, 100000e6);
        wbtc.transfer(msg.sender, 1e8);
    }
    
    function refill(uint256 usdcAmount, uint256 wbtcAmount) external {
        require(msg.sender == owner, "Not owner");
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        wbtc.transferFrom(msg.sender, address(this), wbtcAmount);
    }
}
```

## 联系支持

如果遇到问题：
1. 检查浏览器控制台错误
2. 检查终端输出
3. 查看 `CHECKLIST.md` 中的排查步骤
4. 运行诊断脚本：
   ```bash
   npx hardhat run scripts/check-contracts.js --network localhost
   ```