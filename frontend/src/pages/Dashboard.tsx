import { useAccount } from 'wagmi';
import { useAccountData, useAssetConfig, useAssetRates, useDeposit, useAllowance } from '../hooks';
import { ADDRESSES } from '../web3/addresses';
import { formatAmount, formatPercentage, formatAPY } from '../utils/format';
import HealthFactorBadge from '../components/HealthFactorBadge';
import ConnectButton from '../components/ConnectButton';

export default function Dashboard() {
    const { address, isConnected } = useAccount();
    const { data: accountData, isLoading: isAccountLoading } = useAccountData();
    const { data: usdcConfig } = useAssetConfig(ADDRESSES.USDC);
    const { data: wbtcConfig } = useAssetConfig(ADDRESSES.WBTC);
    const usdcRates = useAssetRates(ADDRESSES.USDC);
    const wbtcRates = useAssetRates(ADDRESSES.WBTC);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Welcome to DeFi Lending Protocol
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Connect your wallet to get started
                </p>
                <ConnectButton />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <ConnectButton />
            </div>

            {/* 健康因子卡片 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Your Health Factor
                </h2>
                {isAccountLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-12 rounded-lg" />
                ) : accountData ? (
                    <div className="flex items-center justify-between">
                        <HealthFactorBadge healthFactor={accountData.currentHealthFactorRay} size="lg" />
                        <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                            <div>Collateral Value: ${formatAmount(accountData.collateralValueUsdWad, 18, 2)}</div>
                            <div>Debt Value: ${formatAmount(accountData.debtValueUsdWad, 18, 2)}</div>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No account data available</p>
                )}
            </div>

            {/* 资产市场概览 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* USDC 市场 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/reserve/usdc'}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">USDC Market</h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
                            Stablecoin
                        </span>
                    </div>

                    {usdcConfig && (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">LTV</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatPercentage(usdcConfig.ltvBps)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Liquidation Threshold</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatPercentage(usdcConfig.liquidationThresholdBps)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Liquidation Bonus</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatPercentage(usdcConfig.liquidationBonusBps)}
                                </span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Supply APY</span>
                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                        {usdcRates.supplyRate ? formatAPY(usdcRates.supplyRate) : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Borrow APY</span>
                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                        {usdcRates.borrowRate ? formatAPY(usdcRates.borrowRate) : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Utilization</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {usdcRates.utilization ? formatPercentage(usdcRates.utilization) : '0.00%'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* WBTC 市场 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow" onClick={() => window.location.href = '/reserve/wbtc'}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">WBTC Market</h3>
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full text-sm font-medium">
                            Volatile
                        </span>
                    </div>

                    {wbtcConfig && (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">LTV</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatPercentage(wbtcConfig.ltvBps)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Liquidation Threshold</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatPercentage(wbtcConfig.liquidationThresholdBps)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Liquidation Bonus</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatPercentage(wbtcConfig.liquidationBonusBps)}
                                </span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Supply APY</span>
                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                        {wbtcRates.supplyRate ? formatAPY(wbtcRates.supplyRate) : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Borrow APY</span>
                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                        {wbtcRates.borrowRate ? formatAPY(wbtcRates.borrowRate) : '0.00%'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Utilization</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {wbtcRates.utilization ? formatPercentage(wbtcRates.utilization) : '0.00%'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

