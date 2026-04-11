import { WAD, RAY, BPS, BLOCKS_PER_YEAR } from '../protocol/constants';

/**
 * 将金额转换为WAD格式
 * @param amount 金额
 * @param decimals 小数位数
 */
export function toWad(amount: bigint | number, decimals: number): bigint {
    const value = typeof amount === 'bigint' ? amount : BigInt(Math.floor(amount));
    return (value * BigInt(WAD)) / BigInt(10 ** decimals);
}

/**
 * 将WAD格式转换为金额
 * @param wad WAD值
 * @param decimals 小数位数
 */
export function fromWad(wad: bigint, decimals: number): bigint {
    return (wad * BigInt(10 ** decimals)) / BigInt(WAD);
}

/**
 * 将基点转换为百分比
 * @param bps 基点值
 */
export function bpsToPercentage(bps: number | bigint): number {
    return Number(bps) / BPS;
}

/**
 * 将百分比转换为基点
 * @param percentage 百分比值
 */
export function percentageToBps(percentage: number): number {
    return Math.floor(percentage * BPS);
}

/**
 * 计算年化APY
 * @param ratePerBlock 每区块利率（RAY）
 */
export function calculateAPY(ratePerBlock: bigint): number {
    const rate = Number(ratePerBlock) / RAY;
    return (1 + rate) ** BLOCKS_PER_YEAR - 1;
}

/**
 * 计算可借金额
 * @param collateralValue 抵押品价值（WAD）
 * @param ltvBps LTV（基点）
 * @param currentDebt 当前债务（WAD）
 */
export function calculateMaxBorrow(
    collateralValue: bigint,
    ltvBps: number,
    currentDebt: bigint
): bigint {
    const maxDebt = (collateralValue * BigInt(ltvBps)) / BigInt(BPS);
    return maxDebt > currentDebt ? maxDebt - currentDebt : 0n;
}

/**
 * 计算健康因子
 * @param weightedCollateral 加权抵押品（WAD）
 * @param debtValue 债务价值（WAD）
 */
export function calculateHealthFactor(
    weightedCollateral: bigint,
    debtValue: bigint
): bigint {
    if (debtValue === 0n) return BigInt(RAY * 2); // 无债务时返回2.00
    return (weightedCollateral * BigInt(RAY)) / debtValue;
}

/**
 * 计算清算金额
 * @param debtValue 债务价值（WAD）
 * @param collateralValue 抵押品价值（WAD）
 * @param liquidationThresholdBps 清算阈值（基点）
 * @param liquidationBonusBps 清算奖励（基点）
 */
export function calculateLiquidationAmount(
    debtValue: bigint,
    collateralValue: bigint,
    liquidationThresholdBps: number,
    liquidationBonusBps: number
): { maxRepay: bigint; maxSeize: bigint } {
    const weightedCollateral = (collateralValue * BigInt(liquidationThresholdBps)) / BigInt(BPS);
    const healthFactor = (weightedCollateral * BigInt(RAY)) / debtValue;

    if (healthFactor >= BigInt(RAY)) {
        return { maxRepay: 0n, maxSeize: 0n };
    }

    const maxRepay = debtValue;
    const maxSeize = (maxRepay * BigInt(BPS + liquidationBonusBps)) / BigInt(BPS);

    return { maxRepay, maxSeize };
}

/**
 * 计算闪电贷费用
 * @param amount 借款金额
 * @param feeBps 费率（基点）
 */
export function calculateFlashLoanFee(amount: bigint, feeBps: number = 9): bigint {
    return (amount * BigInt(feeBps)) / BigInt(BPS);
}
