// 精度常量
export const WAD = 1e18;
export const RAY = 1e27;
export const BPS = 1e4;

// 健康因子阈值
export const HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e27; // 1.00 in RAY
export const HEALTH_FACTOR_OPTIMAL = 2e27; // 2.00 in RAY

// 区块时间（秒）
export const BLOCK_TIME = 12; // Ethereum平均出块时间

// 年化区块数
export const BLOCKS_PER_YEAR = Math.floor((365 * 24 * 60 * 60) / BLOCK_TIME);

// 闪电贷费率（基点）
export const FLASH_LOAN_FEE_BPS = 9; // 0.09%

// 支持的代币列表
export const SUPPORTED_TOKENS = {
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
    },
    WBTC: {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        decimals: 8,
    },
} as const;

// 默认LTV配置（基点）
export const DEFAULT_LTV_BPS = {
    USDC: 7500, // 75%
    WBTC: 7000, // 70%
} as const;

// 默认清算阈值（基点）
export const DEFAULT_LIQUIDATION_THRESHOLD_BPS = {
    USDC: 8000, // 80%
    WBTC: 7500, // 75%
} as const;

// 默认清算奖励（基点）
export const DEFAULT_LIQUIDATION_BONUS_BPS = {
    USDC: 500, // 5%
    WBTC: 1000, // 10%
} as const;

// 默认储备因子（基点）
export const DEFAULT_RESERVE_FACTOR_BPS = 1000; // 10%

// 默认利率模型参数（Kinked model）
export const DEFAULT_INTEREST_MODEL_PARAMS = {
    baseRatePerYearRay: 0n,
    slope1PerYearRay: 40000000000000000000000000n, // 0.04 * 1e27
    slope2PerYearRay: 1000000000000000000000000000n, // 1.00 * 1e27
    kinkWad: 800000000000000000n, // 0.8 * 1e18
    blocksPerYear: BLOCKS_PER_YEAR,
} as const;

// 按资产映射，便于后续单独配置不同模型
export const INTEREST_MODEL_BY_ASSET = {
    USDC: DEFAULT_INTEREST_MODEL_PARAMS,
    WBTC: DEFAULT_INTEREST_MODEL_PARAMS,
} as const;
