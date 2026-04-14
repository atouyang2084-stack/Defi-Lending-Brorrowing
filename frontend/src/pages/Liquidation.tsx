import { useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import lendingPoolAbi from '../web3/abis/LendingPool.json';
import { ADDRESSES } from '../web3/addresses';
import ConnectButton from '../components/ConnectButton';
import TxButton from '../components/TxButton';

export default function Liquidation() {
    const { isConnected } = useAccount();
    const [borrowerAddress, setBorrowerAddress] = useState('');
    const [debtAsset, setDebtAsset] = useState<string>(ADDRESSES.USDC || '');
    const [collateralAsset, setCollateralAsset] = useState<string>(ADDRESSES.WBTC || '');
    const [repayAmount, setRepayAmount] = useState('');
    const [minSeizeAmount, setMinSeizeAmount] = useState('0');

    // 读取借款人的健康因子
    const { data: healthFactorData } = useReadContract({
        address: ADDRESSES.LENDING_POOL as `0x${string}`,
        abi: lendingPoolAbi,
        functionName: 'healthFactor',
        args: [borrowerAddress as `0x${string}`],
        query: {
            enabled: !!borrowerAddress && borrowerAddress.startsWith('0x'),
        },
    });

    // 读取借款人债务余额
    const { data: debtBalanceData } = useReadContract({
        address: ADDRESSES.LENDING_POOL as `0x${string}`,
        abi: lendingPoolAbi,
        functionName: 'userBorrowBalance',
        args: [borrowerAddress as `0x${string}`, debtAsset as `0x${string}`],
        query: {
            enabled: !!borrowerAddress && borrowerAddress.startsWith('0x') && !!debtAsset,
        },
    });

    // 读取借款人抵押品余额
    const { data: collateralBalanceData } = useReadContract({
        address: ADDRESSES.LENDING_POOL as `0x${string}`,
        abi: lendingPoolAbi,
        functionName: 'userSupplyBalance',
        args: [borrowerAddress as `0x${string}`, collateralAsset as `0x${string}`],
        query: {
            enabled: !!borrowerAddress && borrowerAddress.startsWith('0x') && !!collateralAsset,
        },
    });

    // 清算交易
    const { writeContract, isPending, error } = useWriteContract();

    const handleLiquidate = () => {
        if (!borrowerAddress || !debtAsset || !collateralAsset || !repayAmount) {
            alert('请填写所有必填字段');
            return;
        }

        writeContract({
            address: ADDRESSES.LENDING_POOL as `0x${string}`,
            abi: lendingPoolAbi,
            functionName: 'liquidate',
            args: [
                borrowerAddress as `0x${string}`,
                debtAsset as `0x${string}`,
                collateralAsset as `0x${string}`,
                BigInt(parseFloat(repayAmount) * 10 ** 6), // USDC有6位小数
                BigInt(parseFloat(minSeizeAmount) * 10 ** 8), // WBTC有8位小数
            ],
        });
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    清算面板
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    连接钱包以开始清算
                </p>
                <ConnectButton />
            </div>
        );
    }

    const healthFactor = healthFactorData ? Number(formatUnits(healthFactorData as bigint, 27)) : 0;
    const isLiquidatable = healthFactor < 1 && healthFactor > 0;
    const debtBalance = typeof debtBalanceData === 'bigint' ? debtBalanceData : null;
    const collateralBalance = typeof collateralBalanceData === 'bigint' ? collateralBalanceData : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    清算面板
                </h1>
                <ConnectButton />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    清算可危仓位
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    当借款人的健康因子低于1时，任何人都可以清算其仓位。清算人偿还部分债务并获得抵押品作为奖励。
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            借款人地址 *
                        </label>
                        <input
                            type="text"
                            value={borrowerAddress}
                            onChange={(e) => setBorrowerAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                债务资产 *
                            </label>
                            <select
                                value={debtAsset}
                                onChange={(e) => setDebtAsset(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value={ADDRESSES.USDC || ''}>USDC</option>
                                <option value={ADDRESSES.WBTC || ''}>WBTC</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                抵押资产 *
                            </label>
                            <select
                                value={collateralAsset}
                                onChange={(e) => setCollateralAsset(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value={ADDRESSES.WBTC || ''}>WBTC</option>
                                <option value={ADDRESSES.USDC || ''}>USDC</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                偿还金额 *
                            </label>
                            <input
                                type="number"
                                value={repayAmount}
                                onChange={(e) => setRepayAmount(e.target.value)}
                                placeholder="例如: 1000"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {debtBalance !== null && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    借款人当前债务: {formatUnits(debtBalance, debtAsset === ADDRESSES.USDC ? 6 : 8)}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                最小扣押金额
                            </label>
                            <input
                                type="number"
                                value={minSeizeAmount}
                                onChange={(e) => setMinSeizeAmount(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            {collateralBalance !== null && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    借款人当前抵押: {formatUnits(collateralBalance, collateralAsset === ADDRESSES.WBTC ? 8 : 6)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 健康因子显示 */}
                    {borrowerAddress && healthFactor > 0 && (
                        <div className={`p-4 rounded-lg ${isLiquidatable ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold">借款人健康因子</h3>
                                    <p className={`text-2xl font-bold ${isLiquidatable ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {healthFactor.toFixed(4)}
                                    </p>
                                </div>
                                <div>
                                    {isLiquidatable ? (
                                        <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full text-sm font-medium">
                                            可清算
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm font-medium">
                                            安全
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                {isLiquidatable
                                    ? '健康因子低于1，该仓位可以被清算。'
                                    : '健康因子高于1，该仓位目前安全。'}
                            </p>
                        </div>
                    )}

                    {/* 错误显示 */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <h3 className="text-red-800 dark:text-red-300 font-semibold mb-2">交易错误</h3>
                            <p className="text-red-700 dark:text-red-400 text-sm">{error.message}</p>
                        </div>
                    )}

                    {/* 清算按钮 */}
                    <div className="pt-4">
                        <TxButton
                            onClick={handleLiquidate}
                            isPending={isPending}
                            disabled={!isLiquidatable || !repayAmount}
                            fullWidth={true}
                        >
                            {isPending ? '清算中...' : '执行清算'}
                        </TxButton>
                        {!isLiquidatable && borrowerAddress && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                                只有当健康因子低于1时才能执行清算
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
                    如何测试清算机制
                </h3>
                <ol className="space-y-2 text-blue-700 dark:text-blue-400">
                    <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-800 dark:text-blue-300 text-sm font-bold mr-2 flex-shrink-0">1</span>
                        <span>使用测试账户创建借款仓位（存入WBTC，借出USDC）</span>
                    </li>
                    <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-800 dark:text-blue-300 text-sm font-bold mr-2 flex-shrink-0">2</span>
                        <span>运行价格模拟脚本使健康因子低于1：<code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-sm">node scripts/simulate-price-drop.js</code></span>
                    </li>
                    <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-800 dark:text-blue-300 text-sm font-bold mr-2 flex-shrink-0">3</span>
                        <span>使用另一个账户作为清算人，在此页面执行清算</span>
                    </li>
                    <li className="flex items-start">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-800 dark:text-blue-300 text-sm font-bold mr-2 flex-shrink-0">4</span>
                        <span>清算人偿还部分债务并获得抵押品+清算奖励</span>
                    </li>
                </ol>
            </div>
        </div>
    );
}