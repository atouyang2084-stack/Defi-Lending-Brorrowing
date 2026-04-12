# 🔧 修复MetaMask无交互问题

当点击deposit/withdraw按钮时，MetaMask没有弹出确认窗口，通常有以下原因：

## 🎯 问题诊断步骤

### 步骤1：检查浏览器控制台（最重要！）
1. 按 **F12** 打开开发者工具
2. 点击 **Console** 标签页
3. 点击deposit按钮
4. 查看是否有红色错误信息

**预期看到**：
```
=== useDeposit.deposit开始 ===
参数: {asset: "0x...", amount: "10000000", onBehalfOf: "0x..."}
LENDING_POOL地址: 0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154
writeContract调用成功，等待MetaMask确认...
```

### 步骤2：检查钱包连接状态
1. 前端是否显示钱包地址？（而不是"Connect Wallet"）
2. 点击"Connect Wallet"按钮是否能连接？
3. MetaMask是否弹出连接请求？

### 步骤3：检查网络
1. MetaMask顶部显示什么网络？
2. 应该是 **"Localhost 8545"** 或 **"31337"**
3. 如果不是，需要添加网络：
   - 名称: `Localhost 8545`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - 货币符号: `ETH`

### 步骤4：直接测试MetaMask连接
1. 打开测试页面：`file:///路径/test-metamask-direct.html`
2. 点击"连接钱包"按钮
3. 点击"测试writeContract"按钮
4. MetaMask是否弹出？

## 🔍 常见问题及解决方案

### ❌ 问题1：前端显示"Connect Wallet"（钱包未连接）
**解决方案**：
1. 点击"Connect Wallet"按钮
2. 确保MetaMask弹出连接请求
3. 点击"连接"或"下一步"

### ❌ 问题2：网络错误（不是localhost:8545）
**解决方案**：
```javascript
// 在浏览器控制台检查网络
await window.ethereum.request({ method: 'eth_chainId' })
// 应该返回 "0x7a69" (31337的十六进制)
```

如果不是，在MetaMask中添加本地网络。

### ❌ 问题3：JavaScript错误
**检查控制台是否有以下错误**：

1. **"writeContract is not a function"**
   - 原因：wagmi配置错误
   - 解决：重启前端 `npm run dev`

2. **"Invalid address"**
   - 原因：合约地址错误
   - 解决：运行 `npm run transmit` 更新地址

3. **"user rejected request"**
   - 原因：用户拒绝了MetaMask请求
   - 解决：在MetaMask中点击确认

### ❌ 问题4：合约ABI错误
**解决方案**：
```bash
# 重新生成ABI
npm run transmit

# 重启前端
cd frontend
npm run dev
```

### ❌ 问题5：浏览器缓存
**解决方案**：
1. 硬刷新：**Ctrl + F5**（Windows）或 **Cmd + Shift + R**（Mac）
2. 清除缓存：开发者工具 → Application → Clear storage → Clear site data

## 🛠️ 手动测试

### 测试1：直接HTML测试
```bash
# 在浏览器中打开
open test-metamask-direct.html
# 或双击文件
```

### 测试2：脚本测试
```bash
# 测试合约功能
npx hardhat run scripts/test-deposit-manual.js --network localhost
```

### 测试3：RPC测试
```javascript
// 在浏览器控制台测试RPC
fetch('http://127.0.0.1:8545', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  })
}).then(r => r.json()).then(console.log)
```

## 📋 检查清单

- [ ] 浏览器控制台没有红色错误
- [ ] 前端显示钱包地址（不是"Connect Wallet"）
- [ ] MetaMask网络是"Localhost 8545" (31337)
- [ ] 点击按钮后有console.log输出
- [ ] `contract-addresses.json`文件存在
- [ ] `frontend/src/web3/abis/`中有ABI文件
- [ ] Hardhat节点正在运行 (`npx hardhat node`)
- [ ] 前端正在运行 (`npm run dev`)

## 🚨 紧急修复

如果以上都不行，尝试：

### 1. 完全重启
```bash
# 1. 关闭所有终端
# 2. 启动Hardhat节点
npx hardhat node

# 3. 新终端：部署合约
npx hardhat run contracts/script/deploy.js --network localhost
npm run transmit

# 4. 新终端：启动前端
cd frontend
npm run dev
```

### 2. 重新安装依赖
```bash
# 删除node_modules
rm -rf node_modules frontend/node_modules

# 重新安装
npm install
cd frontend && npm install && cd ..
```

### 3. 使用不同浏览器
- Chrome
- Firefox
- Brave

## 📞 需要更多帮助？

如果问题仍然存在，请提供：

1. **浏览器控制台截图**（包含所有错误）
2. **前端页面截图**
3. **MetaMask网络截图**
4. **具体操作步骤**

这样我可以更准确地诊断问题！