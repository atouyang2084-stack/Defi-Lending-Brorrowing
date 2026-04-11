# 🛠 开发与部署指南 (Backend)

本文档旨在帮助前端同学快速搭建本地环境并连接合约。

## 1. 环境准备
在根目录下运行以下命令安装 Hardhat 及相关依赖：
```bash
npm install
```

## 2. 编译合约 (生成 ABI)

运行编译命令，这会在本地生成 `artifacts/` 文件夹，前端所需的 ABI 就在其中。

npx hardhat compile

**LendingPool ABI 地址**: `artifacts/contracts/src/core/LendingPool.sol/LendingPool.json`

**USDC ABI 地址**: `artifacts/contracts/test/mocks/MockERC20.sol/MockERC20.json`

## 3. 本地部署与地址获取
部署脚本在 contracts/script/deploy.js
请按顺序执行以下两步：

1. **启动本地链** (需保持窗口开启):

   npx hardhat node

​    2.**执行部署脚本**:

npx hardhat run contracts/script/deploy.js --network localhost

部署完成后，所有合约的最新地址将自动保存至：`contracts/contract-addresses.json`



### 4.自动化测试

运行以下命令验证核心逻辑（存借、清算、闪电贷）是否正常：

npx hardhat test test/LendingPool.test.js

