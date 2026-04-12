#!/bin/bash

# ============================================
# GitHub上传前清理脚本
# 删除调试文件和不需要上传的内容
# ============================================

echo "🧹 开始清理项目文件..."

# 1. 删除前端调试文件
echo "删除前端调试文件..."
rm -f frontend/public/test.html
rm -f frontend/public/simple-test.html
rm -f frontend/public/test-repay.html

# 2. 删除脚本调试文件
echo "删除脚本调试文件..."
rm -f scripts/analyze-*.js
rm -f scripts/check-*.js 2>/dev/null
rm -f scripts/debug-*.js
rm -f scripts/diagnose-*.js
rm -f scripts/find-min-deposit.js
rm -f scripts/manual-approve.js

# 3. 删除根目录调试文件
echo "删除根目录调试文件..."
rm -f check-balances.js
rm -f check-borrow-availability.js
rm -f check-liquidity.js
rm -f complete-test.js
rm -f debug-repay.js
rm -f quick-test.js

# 4. 删除合约测试调试文件
echo "删除合约测试调试文件..."
rm -f contracts/test/debug.test.js
rm -f contracts/test/simple.test.js
rm -f contracts/test/test-deposit.js
rm -f contracts/test/LendingPool-fixed.test.js

# 5. 保留必要的脚本文件
echo "保留必要的脚本文件..."
# 这些是必要的，不要删除：
# scripts/copy-abi.js          # ABI复制脚本
# scripts/faucet.js            # 水龙头脚本
# scripts/mint-to-any-account.js # 发币脚本
# scripts/check-contracts.js   # 合约检查脚本

# 6. 删除构建产物（可选）
echo "删除构建产物..."
rm -rf artifacts/ 2>/dev/null
rm -rf cache/ 2>/dev/null
rm -rf frontend/dist/ 2>/dev/null
rm -rf frontend/.vite/ 2>/dev/null

# 7. 删除node_modules（可选，可以重新安装）
read -p "是否删除node_modules？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "删除node_modules..."
    rm -rf node_modules/
    rm -rf frontend/node_modules/
fi

# 8. 创建.gitignore文件（如果不存在）
if [ ! -f .gitignore ]; then
    echo "创建.gitignore文件..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
frontend/node_modules/
pnpm-lock.yaml

# Build outputs
dist/
frontend/dist/
artifacts/
cache/
build/
out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
desktop.ini

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Temporary files
tmp/
temp/

# Coverage
coverage/
.nyc_output/

# TypeScript
*.tsbuildinfo

# Vite
frontend/.vite/

# Hardhat
typechain-types/
EOF
fi

echo "✅ 清理完成！"
echo ""
echo "📁 建议上传的文件结构："
echo "├── contracts/           # 智能合约"
echo "├── frontend/           # 前端应用"
echo "├── scripts/            # 实用脚本"
echo "├── hardhat.config.js   # Hardhat配置"
echo "├── package.json        # 依赖"
echo "├── README.md           # 说明文档"
echo "├── STARTUP_GUIDE.md    # 启动指南"
echo "├── QUICK_START.md      # 快速开始"
echo "├── GET_TEST_TOKENS.md  # 获取代币指南"
echo "├── CHECKLIST.md        # 功能检查清单"
echo "├── .gitignore          # Git忽略文件"
echo "└── contract-addresses.json  # 合约地址示例"
echo ""
echo "🚀 现在可以上传到GitHub了！"