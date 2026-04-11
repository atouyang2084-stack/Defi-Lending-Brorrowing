import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import erc20ABI from '../web3/abis/ERC20.json';
import type { RepayParams } from '../web3/types';

/**
 * 还款Hook
 */
export function useRepay() {
    const { address } = useAccount();
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 执行还款
     */
    function repay(params: RepayParams) {
        writeContract({
            address: ADDRESSES.LENDING_POOL,
            abi: lendingPoolABI,
            functionName: 'repay',
            args: [params],
        });
    }

    return {
        repay,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
    };
}
