import { useReadContract } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type {AssetConfig, ReserveData, TokenInfo} from '../web3/types';
import { SUPPORTED_TOKENS } from '../protocol/constants';

/**
 * 获取单个资产配置
 */
export function useAssetConfig(assetAddress: `0x${string}`) {
    const { data, isLoading, error } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'getAssetConfig',
        args: [assetAddress],
        query: {
            enabled: !!assetAddress,
        },
    });

    const config: AssetConfig | undefined = data
        ? {
              asset: (data as any).asset as `0x${string}`,
              priceFeed: (data as any).priceFeed as `0x${string}`,
              decimals: (data as any).decimals,
              ltvBps: (data as any).ltvBps,
              liquidationThresholdBps: (data as any).liquidationThresholdBps,
              liquidationBonusBps: (data as any).liquidationBonusBps,
              reserveFactorBps: (data as any).reserveFactorBps,
              isActive: (data as any).isActive,
          }
        : undefined;

    return { data: config, isLoading, error };
}

/**
 * 获取单个储备数据
 */
export function useReserveData(assetAddress: `0x${string}`) {
    const { data, isLoading, error } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'getReserveData',
        args: [assetAddress],
        query: {
            enabled: !!assetAddress,
        },
    });

    const reserveData: ReserveData | undefined = data
        ? {
              borrowIndex: (data as any).borrowIndex,
              supplyIndex: (data as any).supplyIndex,
              lastUpdatedBlock: (data as any).lastUpdatedBlock,
              totalBorrowScaled: (data as any).totalBorrowScaled,
              totalSupplyScaled: (data as any).totalSupplyScaled,
              protocolReserves: (data as any).protocolReserves,
          }
        : undefined;

    return { data: reserveData, isLoading, error };
}

/**
 * 获取资产利率
 */
export function useAssetRates(assetAddress: `0x${string}`) {
    const borrowRate = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'getBorrowRatePerBlock',
        args: [assetAddress],
        query: {
            enabled: !!assetAddress,
        },
    });

    const supplyRate = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'getSupplyRatePerBlock',
        args: [assetAddress],
        query: {
            enabled: !!assetAddress,
        },
    });

    const utilization = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'getUtilization',
        args: [assetAddress],
        query: {
            enabled: !!assetAddress,
        },
    });

    return {
        borrowRate: borrowRate.data,
        supplyRate: supplyRate.data,
        utilization: utilization.data,
        isLoading: borrowRate.isLoading || supplyRate.isLoading || utilization.isLoading,
        error: borrowRate.error || supplyRate.error || utilization.error,
    };
}

/**
 * 获取所有支持的代币信息
 */
export function useSupportedTokens() {
    const tokens = Object.entries(SUPPORTED_TOKENS).map(([key, token]) => {
        const address = ADDRESSES[key as keyof typeof ADDRESSES] as `0x${string}`;
        return {
            key,
            address,
            ...token,
        };
    });

    return tokens;
}

/**
 * 获取完整的代币信息（包括配置、储备数据和利率）
 */
export function useTokenInfo(assetAddress: `0x${string}`) {
    const config = useAssetConfig(assetAddress);
    const reserveData = useReserveData(assetAddress);
    const rates = useAssetRates(assetAddress);

    const tokenInfo: TokenInfo | undefined = config.data && reserveData.data
        ? {
              address: assetAddress,
              symbol: Object.values(SUPPORTED_TOKENS).find(t =>
                  t.name === 'USD Coin' || t.name === 'Wrapped Bitcoin'
              )?.symbol || 'Unknown',
              name: config.data.isActive 
                  ? (Object.values(SUPPORTED_TOKENS).find(t =>
                      t.decimals === config.data?.decimals
                  )?.name || 'Unknown')
                  : 'Inactive',
              decimals: config.data.decimals,
              price: 0n, // 需要从预言机获取
              config: config.data,
              reserveData: reserveData.data,
          }
        : undefined;

    return {
        data: tokenInfo,
        isLoading: config.isLoading || reserveData.isLoading || rates.isLoading,
        error: config.error || reserveData.error || rates.error,
        rates: {
            borrowRate: rates.borrowRate,
            supplyRate: rates.supplyRate,
            utilization: rates.utilization,
        },
    };
}
