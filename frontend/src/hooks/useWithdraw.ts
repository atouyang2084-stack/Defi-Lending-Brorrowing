import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type { WithdrawParams } from '../web3/types';

/**
 * 提款Hook
 */
export function useWithdraw() {
    const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    /**
     * 执行提款
     */
    function withdraw(params: WithdrawParams) {
        console.log('=== useWithdraw.withdraw开始 ===');
        console.log('参数:', {
            asset: params.asset,
            amount: params.amount.toString(),
            to: params.to,
            amountHex: '0x' + params.amount.toString(16)
        });
        console.log('LENDING_POOL地址:', ADDRESSES.LENDING_POOL);
        console.log('writeContract函数状态:', {
            isPending,
            error: error?.message
        });

        try {
            const result = writeContract({
                address: ADDRESSES.LENDING_POOL,
                abi: lendingPoolABI,
                functionName: 'withdraw',
                args: [params],
            });
            console.log('writeContract调用返回:', result);
            console.log('✅ writeContract调用成功，等待MetaMask确认...');
        } catch (error: any) {
            console.error('❌ writeContract调用失败:', error);
            console.error('错误名称:', error.name);
            console.error('错误消息:', error.message);
            console.error('错误堆栈:', error.stack);

            // 显示给用户
            alert(`提款调用失败: ${error.message}\n\n请检查:\n1. 钱包是否已连接\n2. 网络是否正确\n3. 浏览器控制台查看详细错误`);
        }
    }

    return {
        withdraw,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
        reset,
    };
}
