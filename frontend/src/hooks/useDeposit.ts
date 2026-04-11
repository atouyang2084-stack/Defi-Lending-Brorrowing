import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import erc20ABI from '../web3/abis/ERC20.json';
import type {DepositParams} from '../web3/types';

/**
 * 存款Hook
 */
export function useDeposit() {
    const { address } = useAccount();
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 检查代币授权额度
     */
    function useAllowance(tokenAddress: `0x${string}`) {
        return useReadContract({
            address: tokenAddress,
            abi: erc20ABI,
            functionName: 'allowance',
            args: [address as `0x${string}`, ADDRESSES.LENDING_POOL],
            query: {
                enabled: !!address,
            },
        });
    }

    /**
     * 授权代币
     */
    function approve(tokenAddress: `0x${string}`, amount: bigint) {
        writeContract({
            address: tokenAddress,
            abi: erc20ABI,
            functionName: 'approve',
            args: [ADDRESSES.LENDING_POOL, amount],
        });
    }

    /**
     * 执行存款
     */
    function deposit(params: DepositParams) {
        writeContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'deposit',
            args: [params],
        });
    }

    return {
        deposit,
        approve,
        useAllowance,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
    };
}
