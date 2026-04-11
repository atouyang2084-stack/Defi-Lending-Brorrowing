import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type { FlashLoanParams } from '../web3/types';

/**
 * 闪电贷Hook
 */
export function useFlashLoan() {
    const { address } = useAccount();
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 执行闪电贷
     */
    function flashLoan(params: FlashLoanParams) {
        writeContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'flashLoan',
            args: [params.receiver, params.asset, params.amount, params.data],
        });
    }

    return {
        flashLoan,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
    };
}
