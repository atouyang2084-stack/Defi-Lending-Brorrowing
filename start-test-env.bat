@echo off
echo ========================================
echo DeFi Lending/Borrowing 测试环境启动脚本
echo ========================================
echo.

echo 步骤1: 启动Hardhat本地节点...
start cmd /k "npx hardhat node"
timeout /t 5 /nobreak >nul

echo.
echo 步骤2: 部署合约...
start cmd /k "npx hardhat run contracts/script/deploy.js --network localhost"
timeout /t 5 /nobreak >nul

echo.
echo 步骤3: 设置测试账户...
start cmd /k "npx hardhat run scripts/setup-test-account-fixed.js --network localhost"
timeout /t 5 /nobreak >nul

echo.
echo 步骤4: 启动前端开发服务器...
cd frontend
start cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo 测试环境已启动！
echo ========================================
echo.
echo 请按以下步骤操作：
echo 1. 打开浏览器访问: http://localhost:5174
echo 2. 在MetaMask中切换到Hardhat Local网络 (http://127.0.0.1:8545)
echo 3. 导入测试账户私钥: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
echo 4. 连接钱包并开始测试
echo.
echo 如果遇到repay时出现InsufficientLiquidity错误：
echo 1. 按F12打开开发者工具
echo 2. 查看控制台日志
echo 3. 检查实际调用的函数名
echo 4. 确认是repay还是borrow
echo.
echo 按任意键退出本脚本...
pause >nul