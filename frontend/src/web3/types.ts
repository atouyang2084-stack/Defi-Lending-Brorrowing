import type {Address} from 'viem';

export interface AssetConfig {
    asset: Address;
    priceFeed: Address;
    decimals: number;
    ltvBps: number;
    liquidationThresholdBps: number;
    liquidationBonusBps: number;
    reserveFactorBps: number;
    isActive: boolean;
}

export interface ReserveData {
    borrowIndex: bigint;
    supplyIndex: bigint;
    lastUpdatedBlock: number;
    totalBorrowScaled: bigint;
    totalSupplyScaled: bigint;
    protocolReserves: bigint;
}

export interface UserAccountData {
    collateralValueUsdWad: bigint;
    debtValueUsdWad: bigint;
    weightedCollateralForHFUsdWad: bigint;
    currentHealthFactorRay: bigint;
}

export interface DepositParams {
    asset: Address;
    amount: bigint;
    onBehalfOf: Address;
}

export interface WithdrawParams {
    asset: Address;
    amount: bigint;
    to: Address;
}

export interface BorrowParams {
    asset: Address;
    amount: bigint;
    onBehalfOf: Address;
}

export interface RepayParams {
    asset: Address;
    amount: bigint;
    onBehalfOf: Address;
}

export interface FlashLoanParams {
    receiver: Address;
    asset: Address;
    amount: bigint;
    data: `0x${string}`;
}

export interface TokenInfo {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
    price: bigint;
    config: AssetConfig;
    reserveData: ReserveData;
}

export interface UserPosition {
    asset: Address;
    supplied: bigint;
    borrowed: bigint;
    collateralUsd: bigint;
    debtUsd: bigint;
}
