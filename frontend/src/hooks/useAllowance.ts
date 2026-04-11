import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import erc20ABI from '../web3/abis/ERC20.json';

/**
 * 代币授权Hook
 */
export function useAllowance(tokenAddress: `0x${string}`) {
    const { address } = useAccount();

    // 读取当前授权额度
    const { data: allowance, isLoading, refetch } = useReadContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, ADDRESSES.LENDING_POOL],
        query: {
            enabled: !!address,
        },
    });

    // 写入授权
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 授权代币
     * @param amount 授权金额，如果为0则使用最大值
     */
    function approve(amount?: bigint) {
        writeContract({
            address: tokenAddress,
            abi: erc20ABI,
            functionName: 'approve',
            args: [ADDRESSES.LENDING_POOL, amount || 2n ** 256n - 1n],
        });
    }

    return {
        allowance,
        isLoading,
        approve,
        isPending,
        isConfirming,
        isSuccess,
        error,
        refetch,
    };
}
