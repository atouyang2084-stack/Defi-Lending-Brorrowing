# 📁 项目结构说明

## 整体结构

```
Defi-Lending-Brorrowing/
├── contracts/           # 智能合约（核心）
├── frontend/           # 前端应用（用户界面）
├── scripts/            # 实用脚本（工具）
├── docs/               # 文档（说明）
├── 配置文件
├── 文档文件
└── 清理脚本
```

## 详细说明

### 1. 📜 智能合约 (`contracts/`)
```
contracts/
├── src/                    # 合约源代码
│   ├── core/              # 核心借贷逻辑
│   │   └── LendingPool.sol # 主合约
│   ├── interfaces/        # 接口定义
│   │   └── ILendingPool.sol
│   └── libraries/         # 工具库
│       └── WadRayMath.sol # 数学计算
├── test/                  # 测试文件
│   ├── mocks/            # 模拟合约
│   │   ├── MockERC20.sol # 测试代币
│   │   └── MockV3Aggregator.sol # 测试预言机
│   └── LendingPool.test.js # 主测试文件
└── script/               # 部署脚本
    └── deploy.js         # 一键部署脚本
```

### 2. 🖥️ 前端应用 (`frontend/`)
```
frontend/
├── src/
│   ├── components/       # React组件
│   │   ├── ConnectButton.tsx # 钱包连接
│   │   ├── Faucet.tsx    # 水龙头组件
│   │   └── HealthFactorBadge.tsx # 健康因子显示
│   ├── hooks/           # 自定义Hooks
│   │   ├── useAccountData.ts # 账户数据
│   │   ├── useAllowance.ts  # 代币授权
│   │   ├── useDeposit.ts    # 存款功能
│   │   ├── useWithdraw.ts   # 提款功能
│   │   ├── useBorrow.ts     # 借款功能
│   │   ├── useRepay.ts      # 还款功能
│   │   ├── useLiquidate.ts  # 清算功能
│   │   ├── useFlashLoan.ts  # 闪电贷功能
│   │   └── useReserves.ts   # 储备数据
│   ├── pages/           # 页面组件
│   │   ├── Dashboard.tsx    # 仪表板
│   │   └── Reserve.tsx      # 资产详情页
│   ├── protocol/        # 协议配置
│   │   └── constants.ts # 常量定义
│   ├── utils/           # 工具函数
│   │   └── format.ts    # 格式化工具
│   ├── web3/            # Web3相关
│   │   ├── abis/        # 合约ABI（自动生成）
│   │   │   ├── LendingPool.json
│   │   │   ├── ERC20.json
│   │   │   └── ChainlinkFeed.json
│   │   ├── addresses.ts # 合约地址
│   │   └── types.ts     # TypeScript类型定义
│   ├── app/             # 应用配置
│   │   └── providers.tsx # 上下文提供者
│   └── main.tsx         # 应用入口
├── public/              # 静态资源
│   └── favicon.svg      # 网站图标
├── index.html           # HTML模板
├── package.json         # 前端依赖
├── tailwind.config.js   # Tailwind CSS配置
├── tsconfig.json        # TypeScript配置
├── vite.config.ts       # Vite构建配置
└── .env.local           # 本地环境变量
```

### 3. 🔧 实用脚本 (`scripts/`)
```
scripts/
├── copy-abi.js          # 复制ABI到前端（重要）
├── faucet.js            # 水龙头脚本（获取测试代币）
├── mint-to-any-account.js # 给任意账户发币
└── check-contracts.js   # 检查合约状态
```

### 4. 📄 配置文件（根目录）
```
hardhat.config.js        # Hardhat配置（网络、编译设置）
package.json             # 项目依赖和脚本
contract-addresses.json  # 合约地址（自动生成）
.env.example             # 环境变量示例
.gitignore               # Git忽略规则
```

### 5. 📚 文档文件
```
README.md               # 项目主说明文档
STARTUP_GUIDE.md        # 详细启动指南（新）
QUICK_START.md          # 快速开始指南
GET_TEST_TOKENS.md      # 获取测试代币指南
CHECKLIST.md            # 功能检查清单
PROJECT_STRUCTURE.md    # 项目结构说明（本文档）
SOLUTION.md             # 解决方案文档
FINAL_SOLUTION.md       # 最终解决方案
```

### 6. 🧹 清理脚本
```
cleanup-for-github.sh   # Linux/Mac清理脚本
cleanup-for-github.bat  # Windows清理脚本
```

## 文件说明

### 核心文件（必须保留）

| 文件 | 用途 | 重要性 |
|------|------|--------|
| `contracts/src/core/LendingPool.sol` | 主借贷合约 | ⭐⭐⭐⭐⭐ |
| `contracts/script/deploy.js` | 一键部署脚本 | ⭐⭐⭐⭐⭐ |
| `frontend/src/hooks/useDeposit.ts` | 存款功能Hook | ⭐⭐⭐⭐⭐ |
| `frontend/src/pages/Reserve.tsx` | 资产操作页面 | ⭐⭐⭐⭐⭐ |
| `scripts/copy-abi.js` | ABI复制脚本 | ⭐⭐⭐⭐ |
| `hardhat.config.js` | 网络配置 | ⭐⭐⭐⭐ |

### 自动生成文件（不要手动修改）

| 文件 | 生成方式 | 说明 |
|------|----------|------|
| `contract-addresses.json` | `deploy.js`生成 | 合约地址文件 |
| `frontend/src/web3/abis/*.json` | `copy-abi.js`生成 | 合约ABI文件 |
| `artifacts/` | `npx hardhat compile` | 编译产物 |
| `cache/` | Hardhat缓存 | 编译缓存 |

### 可以删除的文件（调试用）

| 文件类型 | 示例 | 说明 |
|----------|------|------|
| 前端调试文件 | `frontend/public/test.html` | 临时测试页面 |
| 脚本调试文件 | `scripts/debug-*.js` | 调试脚本 |
| 测试调试文件 | `contracts/test/debug.test.js` | 调试测试 |
| 构建产物 | `frontend/dist/`, `artifacts/` | 可以重新生成 |

## 开发流程

### 1. 合约开发
```
修改合约 → 编译测试 → 部署验证
```

### 2. 前端开发
```
更新ABI → 修改前端 → 测试功能
```

### 3. 完整测试
```
启动节点 → 部署合约 → 启动前端 → 功能测试
```

## GitHub上传建议

### 必须上传
- ✅ 所有源代码（`contracts/src/`, `frontend/src/`）
- ✅ 配置文件（`hardhat.config.js`, `package.json`）
- ✅ 文档文件（`README.md`, `STARTUP_GUIDE.md`等）
- ✅ 实用脚本（`scripts/`下的核心脚本）

### 不要上传
- ❌ `node_modules/`（依赖可以重新安装）
- ❌ 构建产物（`artifacts/`, `dist/`）
- ❌ 环境变量（`.env`, `.env.local`）
- ❌ 调试文件（各种`debug-*.js`, `test.html`）

### 使用清理脚本
```bash
# Windows
cleanup-for-github.bat

# Linux/Mac
bash cleanup-for-github.sh
```

## 快速参考

### 启动命令
```bash
# 三终端启动法
终端1: npx hardhat node
终端2: npx hardhat run contracts/script/deploy.js --network localhost
终端3: cd frontend && npm run dev
```

### 常用脚本
```bash
# 更新ABI
npm run transmit

# 获取测试代币
npm run faucet

# 检查合约
npx hardhat run scripts/check-contracts.js --network localhost
```

现在你的项目结构清晰，可以轻松管理和上传到GitHub！🎯