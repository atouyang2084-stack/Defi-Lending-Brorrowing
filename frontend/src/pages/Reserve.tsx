import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useParams } from 'react-router-dom';
import { useAccountData, useAssetConfig, useAssetRates, useDeposit, useWithdraw, useBorrow, useRepay, useAllowance } from '../hooks';
import { useReserveData } from '../hooks/useReserves';
import { ADDRESSES } from '../web3/addresses';
import erc20ABI from '../web3/abis/ERC20.json';
import lendingPoolABI from '../web3/abis/LendingPool.json';
import { formatAmount, formatPercentage, formatAPY } from '../utils/format';
import AmountInput from '../components/AmountInput';
import TxButton from '../components/TxButton';
import ConnectButton from '../components/ConnectButton';

type Action = 'deposit' | 'withdraw' | 'borrow' | 'repay';

export default function Reserve() {
    const { asset } = useParams<{ asset: string }>();
    const { address, isConnected } = useAccount();
    const [action, setAction] = useState<Action>('deposit');
    const [amount, setAmount] = useState('');
    const [isApprovalRequested, setIsApprovalRequested] = useState(false);
    const [isRepayApprovalRequested, setIsRepayApprovalRequested] = useState(false);
    const { data: accountData, refetch: refetchAccountData } = useAccountData();
    const { data: config } = useAssetConfig(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);
    const rates = useAssetRates(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);
    const { data: reserveData } = useReserveData(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);
    const deposit = useDeposit();
    const withdraw = useWithdraw();
    const borrow = useBorrow();
    const repay = useRepay();
    const allowance = useAllowance(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);
    // repay使用同一个授权实例，因为授权是针对LendingPool的

    // 获取用户余额（添加refetch函数）
    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address,
        },
    });

    // 调试信息
    console.log('Reserve component debug:');
    console.log('asset:', asset);
    console.log('address:', address);
    console.log('config:', config);
    console.log('balance:', balance?.toString());
    console.log('allowance.allowance:', allowance.allowance?.toString());
    console.log('allowance.isLoading:', allowance.isLoading);
    console.log('allowance.isPending:', allowance.isPending);
    console.log('allowance.isConfirming:', allowance.isConfirming);
    console.log('allowance.isSuccess:', allowance.isSuccess);
    console.log('allowance.error:', allowance.error);
    console.log('allowance.allowance:', allowance.allowance?.toString());
    console.log('deposit.error:', deposit.error);
    console.log('deposit.error message:', deposit.error?.message);
    console.log('deposit.error details:', deposit.error);
    console.log('deposit.isPending:', deposit.isPending);
    console.log('deposit.isConfirming:', deposit.isConfirming);
    console.log('deposit.isSuccess:', deposit.isSuccess);
    console.log('deposit.hash:', deposit.hash);
    console.log('repay.error:', repay.error);

    // 获取用户存款余额（添加refetch函数）
    const { data: suppliedBalance, refetch: refetchSupply } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'userSupplyBalance',
        args: [address as `0x${string}`, ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`],
        query: {
            enabled: !!address,
        },
    });

    // 获取用户借款余额（添加refetch函数）
    const { data: borrowedBalance, refetch: refetchBorrow } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: lendingPoolABI,
        functionName: 'userBorrowBalance',
        args: [address as `0x${string}`, ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`],
        query: {
            enabled: !!address,
        },
    });

    // 授权成功后自动存款
    useEffect(() => {
        if (allowance.isSuccess && isApprovalRequested && action === 'deposit' && amount && address && config) {
            console.log('授权成功，自动执行存款...');
            const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** config.decimals));
            console.log('自动存款参数:', {
                asset: config.asset,
                amount: amountBigInt.toString(),
                onBehalfOf: address
            });
            // 重置状态
            setIsApprovalRequested(false);
            deposit.deposit({
                asset: config.asset,
                amount: amountBigInt,
                onBehalfOf: address,
            });
        }
    }, [allowance.isSuccess, isApprovalRequested, action, amount, address, config, deposit]);

    // 授权成功后自动还款
    useEffect(() => {
        console.log('授权自动repay检查:', {
            allowanceIsSuccess: allowance.isSuccess,
            isRepayApprovalRequested,
            action,
            amount,
            address: !!address,
            config: !!config
        });

        if (allowance.isSuccess && isRepayApprovalRequested && action === 'repay' && amount && address && config) {
            console.log('=== repay授权成功，准备自动执行还款 ===');
            const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** config.decimals));

            console.log('自动还款检查:');
            console.log('- 当前授权:', allowance.allowance?.toString() || '0');
            console.log('- 需要授权:', amountBigInt.toString());
            console.log('- 授权是否足够:', allowance.allowance && (allowance.allowance as bigint) >= amountBigInt);

            // 重置状态
            setIsRepayApprovalRequested(false);

            // 等待一下确保授权数据更新
            setTimeout(() => {
                // 再次检查授权是否足够
                if (allowance.allowance && (allowance.allowance as bigint) >= amountBigInt) {
                    console.log('授权足够，执行自动还款...');
                    try {
                        repay.repay({
                            asset: config.asset,
                            amount: amountBigInt,
                            onBehalfOf: address,
                        });
                        console.log('自动还款已发送');
                    } catch (error: any) {
                        console.error('自动还款调用失败:', error);
                        alert(`自动还款失败: ${error.message}\n\n请手动点击还款按钮重试。`);
                    }
                } else {
                    console.error('错误：授权成功后授权仍然不足！');
                    console.log('当前授权:', allowance.allowance?.toString() || '0');
                    console.log('需要授权:', amountBigInt.toString());

                    alert(
                        `授权成功，但授权额度仍然不足。\n\n` +
                        `当前授权: ${formatAmount(allowance.allowance || 0n, config.decimals, 2)} ${asset?.toUpperCase()}\n` +
                        `需要授权: ${formatAmount(amountBigInt, config.decimals, 2)} ${asset?.toUpperCase()}\n\n` +
                        `请等待数据刷新或手动点击还款按钮。`
                    );
                }
            }, 1000); // 等待1秒确保授权数据更新
        }
    }, [allowance.isSuccess, isRepayApprovalRequested, action, amount, address, config, repay, allowance.allowance]);

    // 监听deposit交易哈希变化，交易成功后刷新数据
    useEffect(() => {
        if (deposit.hash && deposit.isSuccess) {
            console.log('存款成功，刷新余额数据...');
            console.log('deposit.hash:', deposit.hash);

            // 重置金额
            setAmount('');

            // 延迟一点确保交易已被处理
            setTimeout(() => {
                console.log('开始刷新数据...');
                refetchBalance().then(result => {
                    console.log('refetchBalance结果:', result);
                }).catch(err => {
                    console.error('refetchBalance错误:', err);
                });

                refetchSupply().then(result => {
                    console.log('refetchSupply结果:', result);
                }).catch(err => {
                    console.error('refetchSupply错误:', err);
                });

                allowance.refetch().then(result => {
                    console.log('allowance.refetch结果:', result);
                }).catch(err => {
                    console.error('allowance.refetch错误:', err);
                });

                refetchAccountData().then(result => {
                    console.log('refetchAccountData结果:', result);
                }).catch(err => {
                    console.error('refetchAccountData错误:', err);
                });

                // 重置deposit状态
                setTimeout(() => {
                    deposit.reset();
                    console.log('deposit状态已重置');
                }, 1000);
            }, 2000);
        }
    }, [deposit.hash, deposit.isSuccess, refetchBalance, refetchSupply, allowance, refetchAccountData]);

    useEffect(() => {
        if (withdraw.hash && withdraw.isSuccess) {
            console.log('提款成功，刷新余额数据...');
            console.log('withdraw.hash:', withdraw.hash);
            refetchBalance();
            refetchSupply();
            refetchAccountData();

            // 重置withdraw状态
            setTimeout(() => {
                withdraw.reset();
                console.log('withdraw状态已重置');
            }, 1000);
        }
    }, [withdraw.hash, withdraw.isSuccess, refetchBalance, refetchSupply, refetchAccountData, withdraw.reset]);

    // 监听borrow交易哈希变化，交易成功后刷新数据
    useEffect(() => {
        if (borrow.hash && borrow.isSuccess) {
            console.log('借款成功，刷新余额数据...');
            console.log('borrow.hash:', borrow.hash);

            // 重置金额
            setAmount('');

            setTimeout(() => {
                refetchBalance();
                refetchSupply();
                refetchBorrow(); // 刷新借款余额
                refetchAccountData(); // 刷新账户数据，因为债务增加了

                // 重置borrow状态
                setTimeout(() => {
                    borrow.reset();
                    console.log('borrow状态已重置');
                }, 1000);
            }, 2000);
        }
    }, [borrow.hash, borrow.isSuccess, refetchBalance, refetchSupply, refetchBorrow, refetchAccountData]);

    // 监听repay交易哈希变化，交易成功后刷新数据
    useEffect(() => {
        console.log('repay.hash变化:', repay.hash);
        if (repay.hash && repay.isSuccess) {
            console.log('=== 还款交易确认成功 ===');
            console.log('交易哈希:', repay.hash);
            console.log('当前借款余额数据:', borrowedBalance?.toString());

            // 重置金额
            setAmount('');

            setTimeout(() => {
                console.log('开始刷新数据...');
                console.log('调用 refetchBalance...');
                refetchBalance().then(result => {
                    console.log('refetchBalance完成，数据:', result.data?.toString());
                }).catch(err => {
                    console.error('refetchBalance错误:', err);
                });

                console.log('调用 refetchSupply...');
                refetchSupply().then(result => {
                    console.log('refetchSupply完成，数据:', result.data?.toString());
                }).catch(err => {
                    console.error('refetchSupply错误:', err);
                });

                console.log('调用 refetchBorrow...');
                refetchBorrow().then(result => {
                    console.log('refetchBorrow完成，数据:', result.data?.toString());
                    console.log('新的借款余额:', result.data?.toString());
                }).catch(err => {
                    console.error('refetchBorrow错误:', err);
                });

                console.log('调用 allowance.refetch...');
                allowance.refetch().then(result => {
                    console.log('allowance.refetch完成，数据:', result.data?.toString());
                }).catch(err => {
                    console.error('allowance.refetch错误:', err);
                });

                console.log('调用 refetchAccountData...');
                refetchAccountData().then(result => {
                    console.log('refetchAccountData完成，数据:', result.data);
                }).catch(err => {
                    console.error('refetchAccountData错误:', err);
                });

                // 重置repay状态，确保可以再次repay
                console.log('重置repay状态...');
                setTimeout(() => {
                    repay.reset();
                    console.log('repay状态已重置');
                }, 1000);
            }, 2000);
        }
    }, [repay.hash, repay.isSuccess, refetchBalance, refetchSupply, refetchBorrow, allowance, refetchAccountData]);

    // 监听借款余额变化
    useEffect(() => {
        console.log('借款余额变化:', borrowedBalance?.toString());
    }, [borrowedBalance]);

    // 监听授权状态变化
    useEffect(() => {
        console.log('授权状态变化:', {
            allowance: allowance.allowance?.toString(),
            isLoading: allowance.isLoading,
            isPending: allowance.isPending,
            isConfirming: allowance.isConfirming,
            isSuccess: allowance.isSuccess,
            error: allowance.error,
            hash: allowance.hash
        });
    }, [allowance.allowance, allowance.isLoading, allowance.isPending, allowance.isConfirming, allowance.isSuccess, allowance.error, allowance.hash]);

    // 监听还款状态变化
    useEffect(() => {
        console.log('repay状态变化:', {
            isPending: repay.isPending,
            isConfirming: repay.isConfirming,
            isSuccess: repay.isSuccess,
            error: repay.error,
            hash: repay.hash
        });
    }, [repay.isPending, repay.isConfirming, repay.isSuccess, repay.error, repay.hash]);

    // 监听还款错误
    useEffect(() => {
        if (repay.error) {
            console.log('=== 还款错误 ===');
            console.log('repay.error:', repay.error);
            console.log('repay.error.message:', repay.error.message);
            console.log('repay.error.name:', repay.error.name);
            console.log('repay.error.stack:', repay.error.stack);
        }
    }, [repay.error]);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Connect Your Wallet
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Please connect your wallet to interact with the protocol
                </p>
                <ConnectButton />
            </div>
        );
    }

    if (!config) {
        return <div className="text-center py-8">Asset not found</div>;
    }

    const handleAction = () => {
        if (!amount || !address) return;

        console.log('handleAction called:', { action, amount, address });

        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** config.decimals));
        console.log('amountBigInt:', amountBigInt.toString());

        switch (action) {
            case 'deposit':
                console.log('deposit - allowance.allowance:', allowance.allowance?.toString());
                console.log('deposit - amountBigInt:', amountBigInt.toString());
                console.log('deposit - allowance.allowance < amountBigInt?', allowance.allowance ? (allowance.allowance as bigint) < amountBigInt : 'allowance.allowance is undefined');
                console.log('deposit - allowance.isLoading:', allowance.isLoading);
                console.log('deposit - allowance.error:', allowance.error);

                // 修复：检查allowance.data是否为undefined或不足
                if (allowance.isLoading) {
                    console.log('授权数据加载中，请稍候...');
                    // 可以在这里显示加载提示
                } else if (!allowance.allowance || (allowance.allowance as bigint) < amountBigInt) {
                    if (!isApprovalRequested) {
                        console.log('需要授权，推荐最大值授权...');

                        // 显示授权提示，推荐最大值
                        const authChoice = confirm(
                            `存款需要授权 ${asset?.toUpperCase()} 给合约。\n\n` +
                            `当前授权: ${formatAmount(allowance.allowance || 0n, config.decimals, 2)} ${asset?.toUpperCase()}\n` +
                            `本次存款: ${formatAmount(amountBigInt, config.decimals, 2)} ${asset?.toUpperCase()}\n\n` +
                            `💡 建议: 授权最大值（一次授权，多次使用）\n\n` +
                            `点击"确定"授权最大值，点击"取消"仅授权本次存款金额。`
                        );

                        if (authChoice === true) {
                            // 授权最大值
                            console.log('用户选择授权最大值（推荐）');
                            setIsApprovalRequested(true);
                            allowance.approve(0n); // 0表示使用最大值
                        } else if (authChoice === false) {
                            // 仅授权本次金额
                            console.log('用户选择仅授权本次金额:', amountBigInt.toString());
                            setIsApprovalRequested(true);
                            allowance.approve(amountBigInt);
                        } else {
                            console.log('用户取消了授权');
                        }
                    } else {
                        console.log('授权已请求，等待确认...');
                    }
                } else {
                    console.log('已有足够授权，调用deposit.deposit with params:', {
                        asset: config.asset,
                        amount: amountBigInt.toString(),
                        onBehalfOf: address
                    });
                    deposit.deposit({
                        asset: config.asset,
                        amount: amountBigInt,
                        onBehalfOf: address,
                    });
                }
                break;
            case 'withdraw':
                withdraw.withdraw({
                    asset: config.asset,
                    amount: amountBigInt,
                    to: address,
                });
                break;
            case 'borrow':
                console.log('借款参数:', {
                    asset: config.asset,
                    amount: amountBigInt.toString(),
                    onBehalfOf: address,
                    amountBigInt: amountBigInt.toString()
                });

                // 检查可用流动性
                if (reserveData) {
                    const availableLiquidity = reserveData.totalSupplyScaled - reserveData.totalBorrowScaled - reserveData.protocolReserves;
                    console.log('可用流动性:', availableLiquidity.toString());
                    console.log('借款金额:', amountBigInt.toString());
                    console.log('是否超过流动性:', amountBigInt > availableLiquidity);
                }

                borrow.borrow({
                    asset: config.asset,
                    amount: amountBigInt,
                    onBehalfOf: address,
                });
                break;
            case 'repay':
                console.log('=== 还款开始 ===');
                console.log('还款参数:', {
                    asset: config.asset,
                    amount: amountBigInt.toString(),
                    amountHex: '0x' + amountBigInt.toString(16),
                    onBehalfOf: address,
                    borrowedBalance: borrowedBalance?.toString(),
                    allowance: allowance.allowance?.toString(),
                    configAsset: config.asset,
                    configDecimals: config.decimals
                });

                // 检查是否有借款余额
                const borrowedBalanceBigInt = borrowedBalance as bigint;
                if (!borrowedBalance || borrowedBalanceBigInt === 0n) {
                    console.error('错误: 没有借款余额，无需还款');
                    alert('错误: 您没有借款余额，无需还款');
                    return;
                }

                // 检查还款金额是否超过借款余额
                if (amountBigInt > borrowedBalanceBigInt) {
                    console.error('错误: 还款金额超过借款余额');
                    alert(`错误: 还款金额不能超过借款余额 (${formatAmount(borrowedBalanceBigInt, config.decimals, 2)} ${asset?.toUpperCase()})`);
                    return;
                }

                // 检查授权是否足够
                console.log('检查授权状态:');
                console.log('- 借款余额:', borrowedBalanceBigInt.toString());
                console.log('- 还款金额:', amountBigInt.toString());
                console.log('- 当前授权:', allowance.allowance?.toString() || '0');
                console.log('- 需要授权:', amountBigInt.toString());

                // 检查授权是否足够
                if (!allowance.allowance || (allowance.allowance as bigint) < amountBigInt) {
                    console.log('授权不足，需要先授权...');
                    console.log('当前授权:', allowance.allowance?.toString() || '0');
                    console.log('需要授权:', amountBigInt.toString());

                    // 显示授权提示，默认推荐最大值授权
                    const authChoice = confirm(
                        `还款需要授权 ${asset?.toUpperCase()} 给合约。\n\n` +
                        `当前授权: ${formatAmount(allowance.allowance || 0n, config.decimals, 2)} ${asset?.toUpperCase()}\n` +
                        `本次还款: ${formatAmount(amountBigInt, config.decimals, 2)} ${asset?.toUpperCase()}\n\n` +
                        `💡 建议: 授权最大值（一次授权，多次使用）\n\n` +
                        `点击"确定"授权最大值，点击"取消"仅授权本次还款金额。`
                    );

                    if (authChoice === true) {
                        // 用户点击"确定"：授权最大值（推荐）
                        console.log('用户选择授权最大值（推荐）');
                        setIsRepayApprovalRequested(true);
                        try {
                            allowance.approve(0n); // 0表示使用最大值
                            console.log('授权交易已发送（最大值）');
                        } catch (error: any) {
                            console.error('授权调用失败:', error);
                            alert(`授权失败: ${error.message}\n\n请检查钱包连接和网络状态。`);
                            setIsRepayApprovalRequested(false);
                        }
                    } else if (authChoice === false) {
                        // 用户点击"取消"：仅授权本次金额
                        console.log('用户选择仅授权本次金额:', amountBigInt.toString());
                        setIsRepayApprovalRequested(true);
                        try {
                            allowance.approve(amountBigInt);
                            console.log('授权交易已发送（特定金额）');
                        } catch (error: any) {
                            console.error('授权调用失败:', error);
                            alert(`授权失败: ${error.message}\n\n请检查钱包连接和网络状态。`);
                            setIsRepayApprovalRequested(false);
                        }
                    } else {
                        // 用户关闭了对话框
                        console.log('用户取消了授权');
                    }
                    return; // 等待授权完成
                }

                console.log('授权足够，执行还款...');
                try {
                    repay.repay({
                        asset: config.asset,
                        amount: amountBigInt,
                        onBehalfOf: address,
                    });
                    console.log('repay.repay调用成功 - 交易已发送到钱包等待确认');
                } catch (error: any) {
                    console.error('还款调用失败:', error);
                    console.error('错误堆栈:', error.stack);
                    // 显示错误信息给用户
                    let errorMessage = `还款失败: ${error.message}\n\n可能原因:\n`;

                    if (error.message.includes('InsufficientLiquidity')) {
                        errorMessage += '⚠️ 注意: InsufficientLiquidity错误不应该在还款时出现！\n';
                        errorMessage += '这个错误通常表示池子流动性不足，但还款不需要池子流动性。\n';
                        errorMessage += '请检查你是否在尝试借款而不是还款。\n';
                    } else if (error.message.includes('transferFrom')) {
                        errorMessage += '1. 授权不足 - 请先授权\n';
                        errorMessage += '2. 余额不足 - 检查钱包余额\n';
                    } else if (error.message.includes('user rejected')) {
                        errorMessage += '用户拒绝了交易\n';
                    } else if (error.message.includes('insufficient funds')) {
                        errorMessage += '余额不足\n';
                    } else {
                        errorMessage += '1. 授权不足 - 请先授权\n';
                        errorMessage += '2. 余额不足 - 检查钱包余额\n';
                        errorMessage += '3. 借款余额为0 - 无需还款\n';
                    }

                    alert(errorMessage);
                }
                break;
            default:
                break;
        }
    };

    const getActionButtonText = () => {
        if (!amount) return 'Enter Amount';

        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** config.decimals));

        if (action === 'deposit') {
            if (allowance.allowance && (allowance.allowance as bigint) < amountBigInt) {
                return 'Approve';
            }
            return 'Deposit';
        }

        if (action === 'repay') {
            // 如果正在等待授权确认，显示"Approving..."
            if (isRepayApprovalRequested && allowance.isPending) {
                return 'Approving...';
            }
            // 如果授权不足，显示"Approve"
            if (allowance.allowance && (allowance.allowance as bigint) < amountBigInt) {
                return 'Approve';
            }
            return 'Repay';
        }

        return action.charAt(0).toUpperCase() + action.slice(1);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {asset?.toUpperCase()} Market
                </h1>
                <ConnectButton />
            </div>

            {/* 市场信息卡片 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Supply APY</div>
                        <div className="text-xl font-semibold text-green-600 dark:text-green-400">
                            {rates.supplyRate ? formatAPY(rates.supplyRate as bigint) : '0.00%'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Borrow APY</div>
                        <div className="text-xl font-semibold text-red-600 dark:text-red-400">
                            {rates.borrowRate ? formatAPY(rates.borrowRate as bigint) : '0.00%'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">LTV</div>
                        <div className="text-xl font-semibold text-gray-900 dark:text-white">
                            {formatPercentage(config.ltvBps)}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Liquidation Threshold</div>
                        <div className="text-xl font-semibold text-gray-900 dark:text-white">
                            {formatPercentage(config.liquidationThresholdBps)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 用户余额信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Your Supplies
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Supplied Balance</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {suppliedBalance ? formatAmount(suppliedBalance as bigint, config.decimals, 2) : '0.00'} {asset?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Wallet Balance</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {balance ? formatAmount(balance as bigint, config.decimals, 2) : '0.00'} {asset?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Your Borrows
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Borrowed Balance</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {borrowedBalance ? formatAmount(borrowedBalance as bigint, config.decimals, 2) : '0.00'} {asset?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Borrow APY</span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                                {rates.borrowRate ? formatAPY(rates.borrowRate as bigint) : '0.00%'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 操作面板 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                {/* 操作类型选择 */}
                <div className="flex gap-2 mb-6">
                    {(['deposit', 'withdraw', 'borrow', 'repay'] as Action[]).map((act) => (
                        <button
                            key={act}
                            onClick={() => setAction(act)}
                            className={`
                                px-4 py-2 rounded-lg font-medium transition-colors
                                ${action === act
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }
                            `}
                        >
                            {act.charAt(0).toUpperCase() + act.slice(1)}
                        </button>
                    ))}
                </div>

                {/* 金额输入 */}
                <div className="mb-6">
                    <AmountInput
                        value={amount}
                        onChange={setAmount}
                        max={action === 'deposit' ? balance as bigint | undefined :
                             action === 'withdraw' ? suppliedBalance as bigint | undefined :
                             action === 'borrow' && accountData && reserveData && config ?
                             (() => {
                                 console.log('计算最大可借款 - 输入参数:', {
                                     collateralValueUsdWad: accountData.collateralValueUsdWad.toString(),
                                     debtValueUsdWad: accountData.debtValueUsdWad.toString(),
                                     ltvBps: config.ltvBps.toString(),
                                     decimals: config.decimals
                                 });

                                 // 基于抵押品的最大可借款（USD，18位小数）
                                 const maxByCollateralUsd = (accountData.collateralValueUsdWad * BigInt(config.ltvBps)) / 10000n - accountData.debtValueUsdWad;

                                 console.log('maxByCollateralUsd计算:', {
                                     collateralValueUsdWad: accountData.collateralValueUsdWad.toString(),
                                     ltvBps: config.ltvBps.toString(),
                                     collateralTimesLtv: (accountData.collateralValueUsdWad * BigInt(config.ltvBps)).toString(),
                                     collateralTimesLtvDiv10000: ((accountData.collateralValueUsdWad * BigInt(config.ltvBps)) / 10000n).toString(),
                                     debtValueUsdWad: accountData.debtValueUsdWad.toString(),
                                     maxByCollateralUsd: maxByCollateralUsd.toString()
                                 });

                                 // 转换为资产数量（考虑资产小数位）
                                 // USDC价格是1美元，所以直接转换：从18位小数转到资产小数位
                                 const decimalsDiff = 18 - config.decimals;
                                 const maxByCollateral = maxByCollateralUsd > 0n ? maxByCollateralUsd / (10n ** BigInt(decimalsDiff)) : 0n;

                                 // 借贷池可用流动性
                                 const availableLiquidity = reserveData.totalSupplyScaled - reserveData.totalBorrowScaled - reserveData.protocolReserves;

                                 // 取两者中的较小值
                                 const maxBorrow = maxByCollateral > 0n && maxByCollateral < availableLiquidity ? maxByCollateral : (availableLiquidity > 0n ? availableLiquidity : 0n);

                                 console.log('最大可借款计算:', {
                                     maxByCollateralUsd: maxByCollateralUsd.toString(),
                                     maxByCollateral: maxByCollateral.toString(),
                                     availableLiquidity: availableLiquidity.toString(),
                                     maxBorrow: maxBorrow.toString()
                                 });

                                 return maxBorrow;
                             })() :
                             action === 'repay' ? borrowedBalance as bigint | undefined :
                             0n}
                        decimals={config.decimals}
                        symbol={asset?.toUpperCase()}
                    />
                </div>

                {/* 操作按钮 */}
                <TxButton
                    onClick={handleAction}
                    disabled={!amount || deposit.isPending || repay.isPending || allowance.isPending}
                    isPending={deposit.isPending || repay.isPending || allowance.isPending}
                    isConfirming={deposit.isConfirming || repay.isConfirming || allowance.isConfirming}
                    isSuccess={deposit.isSuccess || repay.isSuccess || allowance.isSuccess}
                    fullWidth
                >
                    {getActionButtonText()}
                </TxButton>
            </div>
        </div>
    );
}
