import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type { WithdrawParams } from '../web3/types';

/**
 * 提款Hook
 */
export function useWithdraw() {
    const { address } = useAccount();
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 执行提款
     */
    function withdraw(params: WithdrawParams) {
        writeContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'withdraw',
            args: [params],
        });
    }

    return {
        withdraw,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
    };
}
