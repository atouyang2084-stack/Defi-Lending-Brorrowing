import  { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useParams } from 'react-router-dom';
import { useAccountData, useAssetConfig, useAssetRates, useDeposit, useAllowance } from '../hooks';
import { ADDRESSES } from '../web3/addresses';
import erc20ABI from '../web3/abis/ERC20.json';
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
    const { data: accountData } = useAccountData();
    const { data: config } = useAssetConfig(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);
    const rates = useAssetRates(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);
    const deposit = useDeposit();
    const allowance = useAllowance(ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`);

    // 获取用户余额
    const { data: balance } = useReadContract({
        address: ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address,
        },
    });

    // 获取用户存款余额
    const { data: suppliedBalance } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: require('../web3/abis/LendingPool.json'),
        functionName: 'userSupplyBalance',
        args: [address as `0x${string}`, ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`],
        query: {
            enabled: !!address,
        },
    });

    // 获取用户借款余额
    const { data: borrowedBalance } = useReadContract({
        address: ADDRESSES.LENDING_POOL,
        abi: require('../web3/abis/LendingPool.json'),
        functionName: 'userBorrowBalance',
        args: [address as `0x${string}`, ADDRESSES[asset?.toUpperCase() as keyof typeof ADDRESSES] as `0x${string}`],
        query: {
            enabled: !!address,
        },
    });

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

        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** config.decimals));

        switch (action) {
            case 'deposit':
                if (allowance.allowance && allowance.allowance < amountBigInt) {
                    allowance.approve(amountBigInt);
                } else {
                    deposit.deposit({
                        asset: config.asset,
                        amount: amountBigInt,
                        onBehalfOf: address,
                    });
                }
                break;
            // 其他操作待实现
            default:
                break;
        }
    };

    const getActionButtonText = () => {
        if (!amount) return 'Enter Amount';

        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** config.decimals));

        if (action === 'deposit') {
            if (allowance.allowance && allowance.allowance < amountBigInt) {
                return 'Approve';
            }
            return 'Deposit';
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
                            {rates.supplyRate ? formatAPY(rates.supplyRate) : '0.00%'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Borrow APY</div>
                        <div className="text-xl font-semibold text-red-600 dark:text-red-400">
                            {rates.borrowRate ? formatAPY(rates.borrowRate) : '0.00%'}
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
                                {suppliedBalance ? formatAmount(suppliedBalance, config.decimals, 2) : '0.00'} {asset?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Wallet Balance</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {balance ? formatAmount(balance, config.decimals, 2) : '0.00'} {asset?.toUpperCase()}
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
                                {borrowedBalance ? formatAmount(borrowedBalance, config.decimals, 2) : '0.00'} {asset?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Borrow APY</span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                                {rates.borrowRate ? formatAPY(rates.borrowRate) : '0.00%'}
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
                        max={action === 'deposit' || action === 'repay' ? balance : 
                             action === 'withdraw' ? suppliedBalance : 
                             action === 'borrow' && accountData ? 
                             (accountData.collateralValueUsdWad * BigInt(config.ltvBps)) / 10000n - accountData.debtValueUsdWad : 
                             0n}
                        decimals={config.decimals}
                        symbol={asset?.toUpperCase()}
                    />
                </div>

                {/* 操作按钮 */}
                <TxButton
                    onClick={handleAction}
                    disabled={!amount || deposit.isPending}
                    isPending={deposit.isPending}
                    isConfirming={deposit.isConfirming}
                    isSuccess={deposit.isSuccess}
                    fullWidth
                >
                    {getActionButtonText()}
                </TxButton>
            </div>
        </div>
    );
}
