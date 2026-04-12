import { useAccount, useReadContract } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type {UserAccountData} from '../web3/types';

/**
 * 获取用户账户数据
 * @param address 用户地址，如果不提供则使用当前连接的钱包地址
 */
export function useAccountData(address?: `0x${string}`) {
    const { address: connectedAddress } = useAccount();
    const userAddress = address || connectedAddress;

    const { data, isLoading, error, refetch } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'userAccountData',
        args: userAddress ? [userAddress as `0x${string}`] : undefined,
        query: {
            enabled: !!userAddress,
            refetchInterval: 10000, // 每10秒刷新一次
        },
    });

    const accountData: UserAccountData | undefined = data
        ? {
              collateralValueUsdWad: (data as [bigint, bigint, bigint, bigint])[0],
              debtValueUsdWad: (data as [bigint, bigint, bigint, bigint])[1],
              weightedCollateralForHFUsdWad: (data as [bigint, bigint, bigint, bigint])[2],
              currentHealthFactorRay: (data as [bigint, bigint, bigint, bigint])[3],
          }
        : undefined;

    return {
        data: accountData,
        isLoading,
        error,
        refetch,
    };
}
