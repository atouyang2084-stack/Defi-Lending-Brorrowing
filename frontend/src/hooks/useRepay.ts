import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import type { RepayParams } from '../web3/types';

/**
 * 还款Hook
 */
export function useRepay() {
    const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    // 调试信息
    console.log('useRepay hook状态:', {
        hash,
        isPending,
        error,
        isConfirming,
        isSuccess
    });

    /**
     * 执行还款
     */
    function repay(params: RepayParams) {
        console.log('=== useRepay.repay 开始 ===');
        console.log('参数详情:');
        console.log('- asset:', params.asset);
        console.log('- amount:', params.amount.toString(), '(原始值)');
        console.log('- amount 十六进制:', '0x' + params.amount.toString(16));
        console.log('- onBehalfOf:', params.onBehalfOf);
        console.log('LENDING_POOL 地址:', ADDRESSES.LENDING_POOL);

        try {
            // 测试：使用与测试脚本完全相同的格式
            const repayParams = {
                asset: params.asset,
                amount: params.amount,
                onBehalfOf: params.onBehalfOf
            };

            console.log('repayParams 对象:', JSON.stringify(repayParams, (_key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                return value;
            }));

            const txParams = {
                address: ADDRESSES.LENDING_POOL,
                abi: lendingPoolABI,
                functionName: 'repay',
                args: [repayParams],
            };

            console.log('发送交易参数:', JSON.stringify(txParams, (_key, value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                return value;
            }, 2));

            console.log('调用 writeContract...');
            try {
                writeContract(txParams);
                console.log('writeContract 调用完成 - 交易已发送到钱包');
            } catch (error: any) {
                console.error('❌ writeContract 调用时捕获到错误:', error);
                console.error('错误名称:', error.name);
                console.error('错误消息:', error.message);
                throw error;
            }
        } catch (error: any) {
            console.error('repay 函数捕获到错误:', error);
            console.error('错误详情:', error.message);

            // 重新抛出错误，让上层处理
            throw error;
        }
    }

    return {
        repay,
        isPending,
        isConfirming,
        isSuccess,
        error,
        hash,
        reset, // 暴露reset函数，允许外部重置状态
    };
}
