import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type { BorrowParams } from '../web3/types';

/**
 * 借款Hook
 */
export function useBorrow() {
    const { address } = useAccount();
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 执行借款
     */
    function borrow(params: BorrowParams) {
        writeContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'borrow',
            args: [params],
        });
    }

    return {
        borrow,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
    };
}
