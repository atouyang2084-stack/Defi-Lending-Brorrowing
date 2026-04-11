import { RAY, BPS } from '../protocol/constants';

/**
 * 格式化金额显示
 * @param amount 金额
 * @param decimals 小数位数
 * @param precision 显示精度
 */
export function formatAmount(
    amount: bigint | number,
    decimals: number,
    precision: number = 2
): string {
    const value = typeof amount === 'bigint' ? Number(amount) / 10 ** decimals : amount;
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision,
    });
}

/**
 * 格式化百分比
 * @param value 值（基点）
 * @param precision 显示精度
 */
export function formatPercentage(value: number | bigint, precision: number = 2): string {
    const percentage = Number(value) / BPS;
    return `${percentage.toFixed(precision)}%`;
}

/**
 * 格式化健康因子
 * @param healthFactor 健康因子（RAY）
 */
export function formatHealthFactor(healthFactor: bigint): string {
    const value = Number(healthFactor) / RAY;
    return value.toFixed(2);
}

/**
 * 格式化APY
 * @param ratePerBlock 每区块利率（RAY）
 */
export function formatAPY(ratePerBlock: bigint): string {
    const rate = Number(ratePerBlock) / RAY;
    const blocksPerYear = 2102400; // 以太坊年出块数
    const apy = (1 + rate) ** blocksPerYear - 1;
    return `${(apy * 100).toFixed(2)}%`;
}

/**
 * 格式化地址
 * @param address 地址
 * @param length 前后显示长度
 */
export function formatAddress(address: string, length: number = 6): string {
    if (!address) return '';
    return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * 格式化时间戳
 * @param timestamp 时间戳
 */
export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
