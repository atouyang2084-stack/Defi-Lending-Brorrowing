# 前端Repay问题排查清单

## 问题描述
用户输入1之后，repay会让我确认交易，确认之后就没后续了。

## 已确认的信息
1. ✅ 后端repay功能正常（通过Hardhat脚本测试）
2. ✅ 合约已正确部署到本地网络
3. ✅ 合约地址已更新到前端
4. ✅ 用户有足够的USDC余额和借款余额
5. ✅ 本地Hardhat节点正在运行（端口8545）

## 🔥 核心问题已找到：授权不足

**根本原因**：`allowance: 0` 表示用户没有授权合约从账户扣USDC。还款时合约需要先从用户账户转USDC到池子，但没有授权权限，所以交易会失败。

### 授权机制说明：
- **存款(deposit)**：需要授权USDC给LendingPool合约
- **还款(repay)**：同样需要授权USDC给LendingPool合约
- **授权是一次性的**：授权后合约可以多次使用，直到授权额度用完

## 已实施的修复

1. ✅ **前端添加授权检查** - 在repay前检查授权是否足够
2. ✅ **按钮文本更新** - 授权不足时显示"Approve"而不是"Repay"
3. ✅ **用户流程优化** - 授权成功后需要用户再次点击"Repay"
4. ✅ **错误处理改进** - 更好的错误信息显示

## 其他可能的原因
1. 前端没有正确监听交易状态
2. wagmi配置或使用方式有问题
3. 交易被发送但前端没有收到确认
4. 网络连接或RPC配置问题

## 排查步骤

### 1. 检查控制台日志
打开浏览器开发者工具（F12），切换到Console标签页，然后：
- 尝试执行repay操作
- 查看是否有以下日志：
  - "useRepay hook状态"
  - "=== useRepay.repay 开始 ==="
  - "repay状态变化"
  - 任何错误信息

### 2. 检查MetaMask交易状态
- 打开MetaMask
- 查看活动标签页
- 检查repay交易是否：
  - 被发送
  - 被确认
  - 有错误信息

### 3. 检查网络连接
- 确保MetaMask连接到localhost:8545
- 确保chainId是31337
- 尝试刷新页面
- 尝试重新连接钱包

### 4. 检查前端状态
在Reserve页面，检查：
- 钱包是否已连接
- 是否有借款余额
- 授权是否足够
- 余额是否足够

### 5. 运行诊断脚本
```bash
cd "D:\sem2\comp 5568\project_new\Defi-Lending-Brorrowing"
npx hardhat run scripts/diagnose-frontend-repay.js --network localhost
```

### 6. 测试简单repay
```bash
cd "D:\sem2\comp 5568\project_new\Defi-Lending-Brorrowing"
npx hardhat run scripts/test-repay-simple.js --network localhost
```

## 已实施的修复
1. 更新了前端合约地址
2. 在useRepay.ts中添加了调试日志
3. 在Reserve.tsx中添加了状态监控
4. 修复了writeContract调用方式

## 如果问题仍然存在
1. 提供控制台截图
2. 提供MetaMask交易截图
3. 运行诊断脚本并提供输出
4. 检查浏览器控制台是否有网络错误

## 快速测试
访问测试页面：http://localhost:5173/public/test-repay.html
（需要更新合约地址）