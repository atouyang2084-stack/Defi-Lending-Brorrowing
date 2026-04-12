@echo off
chcp 65001 >nul
echo ============================================
echo GitHub上传前清理脚本
echo 删除调试文件和不需要上传的内容
echo ============================================

echo.
echo 🧹 开始清理项目文件...
echo.

REM 1. 删除前端调试文件
echo 删除前端调试文件...
del /f /q "frontend\public\test.html" 2>nul
del /f /q "frontend\public\simple-test.html" 2>nul
del /f /q "frontend\public\test-repay.html" 2>nul

REM 2. 删除脚本调试文件
echo 删除脚本调试文件...
del /f /q "scripts\analyze-*.js" 2>nul
del /f /q "scripts\check-*.js" 2>nul
del /f /q "scripts\debug-*.js" 2>nul
del /f /q "scripts\diagnose-*.js" 2>nul
del /f /q "scripts\find-min-deposit.js" 2>nul
del /f /q "scripts\manual-approve.js" 2>nul

REM 3. 删除根目录调试文件
echo 删除根目录调试文件...
del /f /q "check-balances.js" 2>nul
del /f /q "check-borrow-availability.js" 2>nul
del /f /q "check-liquidity.js" 2>nul
del /f /q "complete-test.js" 2>nul
del /f /q "debug-repay.js" 2>nul
del /f /q "quick-test.js" 2>nul

REM 4. 删除合约测试调试文件
echo 删除合约测试调试文件...
del /f /q "contracts\test\debug.test.js" 2>nul
del /f /q "contracts\test\simple.test.js" 2>nul
del /f /q "contracts\test\test-deposit.js" 2>nul
del /f /q "contracts\test\LendingPool-fixed.test.js" 2>nul

REM 5. 删除构建产物（可选）
echo 删除构建产物...
rmdir /s /q "artifacts" 2>nul
rmdir /s /q "cache" 2>nul
rmdir /s /q "frontend\dist" 2>nul
rmdir /s /q "frontend\.vite" 2>nul

REM 6. 询问是否删除node_modules
echo.
set /p delete_node="是否删除node_modules？(y/n): "
if /i "%delete_node%"=="y" (
    echo 删除node_modules...
    rmdir /s /q "node_modules" 2>nul
    rmdir /s /q "frontend\node_modules" 2>nul
)

REM 7. 创建.gitignore文件（如果不存在）
if not exist ".gitignore" (
    echo 创建.gitignore文件...
    (
echo # Dependencies
echo node_modules/
echo frontend/node_modules/
echo pnpm-lock.yaml
echo.
echo # Build outputs
echo dist/
echo frontend/dist/
echo artifacts/
echo cache/
echo build/
echo out/
echo.
echo # Environment variables
echo .env
echo .env.local
echo .env.development.local
echo .env.test.local
echo .env.production.local
echo.
echo # IDE
echo .vscode/
echo .idea/
echo *.swp
echo *.swo
echo.
echo # OS
echo .DS_Store
echo Thumbs.db
echo desktop.ini
echo.
echo # Logs
echo *.log
echo npm-debug.log*
echo yarn-debug.log*
echo yarn-error.log*
echo.
echo # Temporary files
echo tmp/
echo temp/
echo.
echo # Coverage
echo coverage/
echo .nyc_output/
echo.
echo # TypeScript
echo *.tsbuildinfo
echo.
echo # Vite
echo frontend/.vite/
echo.
echo # Hardhat
echo typechain-types/
    ) > .gitignore
)

echo.
echo ✅ 清理完成！
echo.
echo 📁 建议上传的文件结构：
echo ├── contracts/           # 智能合约
echo ├── frontend/           # 前端应用
echo ├── scripts/            # 实用脚本
echo ├── hardhat.config.js   # Hardhat配置
echo ├── package.json        # 依赖
echo ├── README.md           # 说明文档
echo ├── STARTUP_GUIDE.md    # 启动指南
echo ├── QUICK_START.md      # 快速开始
echo ├── GET_TEST_TOKENS.md  # 获取代币指南
echo ├── CHECKLIST.md        # 功能检查清单
echo ├── .gitignore          # Git忽略文件
echo └── contract-addresses.json  # 合约地址示例
echo.
echo 🚀 现在可以上传到GitHub了！
echo.
pause