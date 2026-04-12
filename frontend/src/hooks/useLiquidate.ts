import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type { Address } from 'viem';

export interface LiquidateParams {
    collateralAsset: Address;
    debtAsset: Address;
    user: Address;
    debtToCover: bigint;
}

/**
 * 清算Hook
 */
export function useLiquidate() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 执行清算
     */
    function liquidate(params: LiquidateParams) {
        writeContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'liquidationCall',
            args: [params.collateralAsset, params.debtAsset, params.user, params.debtToCover],
        });
    }

    /**
     * 获取用户的健康因子
     */
    function useHealthFactor(userAddress: Address) {
        return useReadContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'userAccountData',
            args: [userAddress],
            query: {
                enabled: !!userAddress,
            },
        });
    }

    /**
     * 获取用户可清算的最大债务
     */
    function getMaxLiquidatableDebt(userAddress: Address, debtAsset: Address) {
        return useReadContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'getUserDebtBalance',
            args: [userAddress, debtAsset],
            query: {
                enabled: !!userAddress && !!debtAsset,
            },
        });
    }

    return {
        liquidate,
        useHealthFactor,
        getMaxLiquidatableDebt,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
    };
}
