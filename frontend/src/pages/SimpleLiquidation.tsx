import { useEffect, useMemo, useState } from 'react';
import { formatUnits, isAddress, parseAbiItem, parseUnits } from 'viem';
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import ConnectButton from '../components/ConnectButton';

// 简化的LendingPool ABI，只包含清算函数
const LIQUIDATE_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "borrower", "type": "address"},
            {"internalType": "address", "name": "debtAsset", "type": "address"},
            {"internalType": "address", "name": "collateralAsset", "type": "address"},
            {"internalType": "uint256", "name": "repayAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "minSeizeAmount", "type": "uint256"}
        ],
        "name": "liquidate",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

const LIQUIDATED_EVENT = parseAbiItem(
    'event Liquidated(address indexed liquidator, address indexed borrower, address indexed debtAsset, address collateralAsset, uint256 repaidAmount, uint256 seizedAmount)'
);

const ORACLE_ABI = [
    {
        inputs: [],
        name: 'latestRoundData',
        outputs: [
            { internalType: 'uint80', name: 'roundId', type: 'uint80' },
            { internalType: 'int256', name: 'answer', type: 'int256' },
            { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
            { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
            { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'int256', name: 'answer', type: 'int256' }],
        name: 'updateAnswer',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

const PRICE_ADMIN_ADDRESSES = [
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
];

const PRICE_PRESETS = [10000, 12000, 15000, 18000, 22000, 26000, 30000, 35000, 40000] as const;

const KNOWN_BORROWERS = [
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
    '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
    '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc',
    '0x976ea74026e726554db657fa54763abd0c3a0aa9',
    '0x14dc79964da2c08b23698b3d3cc7ca32193d9955',
    '0x23618e81e3ecdcf4f6b8f21d14cfece2d5f8f3c1',
    '0xa0ee7a142d267c1f36714e4a8f75612f20a79720',
] as const;

const DASHBOARD_ABI = [
    ...LIQUIDATE_ABI,
    {
        inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
        name: 'healthFactor',
        outputs: [{ internalType: 'uint256', name: 'hfRay', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'user', type: 'address' },
            { internalType: 'address', name: 'asset', type: 'address' },
        ],
        name: 'userBorrowBalance',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'user', type: 'address' },
            { internalType: 'address', name: 'asset', type: 'address' },
        ],
        name: 'userSupplyBalance',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

type LiquidationRecord = {
    txHash: string;
    blockNumber: bigint;
    liquidator: string;
    borrower: string;
    repaidAmount: bigint;
    seizedAmount: bigint;
};

function shortAddress(value: string) {
    if (!value || value.length < 10) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatUsdc(value: bigint) {
    return Number(formatUnits(value, 6)).toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

export default function SimpleLiquidation() {
    const { isConnected, address } = useAccount();
    const publicClient = usePublicClient();

    const [borrowerAddress, setBorrowerAddress] = useState('');
    const [repayAmount, setRepayAmount] = useState('');
    const [records, setRecords] = useState<LiquidationRecord[]>([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
    const [customPrice, setCustomPrice] = useState('15000');

    const {
        writeContract: writeLiquidation,
        isPending: isLiquidating,
        error: liquidationError,
    } = useWriteContract();

    const {
        writeContract: writeOracle,
        isPending: isUpdatingPrice,
        error: oracleError,
    } = useWriteContract();

    const normalizedBorrower = borrowerAddress.trim();
    const validBorrower = isAddress(normalizedBorrower);
    const connectedAddress = (address ?? '').toLowerCase();
    const isPriceAdmin = connectedAddress ? PRICE_ADMIN_ADDRESSES.includes(connectedAddress) : false;

    const parsedRepayAmount = useMemo(() => {
        if (!repayAmount.trim()) return null;
        try {
            const value = parseUnits(repayAmount, 6);
            return value > 0n ? value : null;
        } catch {
            return null;
        }
    }, [repayAmount]);

    const riskAddresses = useMemo(() => {
        const set = new Set<string>(KNOWN_BORROWERS);
        if (validBorrower) {
            set.add(normalizedBorrower.toLowerCase());
        }
        return Array.from(set);
    }, [validBorrower, normalizedBorrower]);

    const riskContracts = useMemo(
        () =>
            riskAddresses.flatMap((candidate) => [
                {
                    address: ADDRESSES.LENDING_POOL,
                    abi: DASHBOARD_ABI,
                    functionName: 'healthFactor',
                    args: [candidate as `0x${string}`],
                },
                {
                    address: ADDRESSES.LENDING_POOL,
                    abi: DASHBOARD_ABI,
                    functionName: 'userSupplyBalance',
                    args: [candidate as `0x${string}`, ADDRESSES.WBTC],
                },
                {
                    address: ADDRESSES.LENDING_POOL,
                    abi: DASHBOARD_ABI,
                    functionName: 'userBorrowBalance',
                    args: [candidate as `0x${string}`, ADDRESSES.USDC],
                },
            ]),
        [riskAddresses]
    );

    const { data: borrowerMetrics, isLoading: borrowerMetricsLoading } = useReadContracts({
        contracts: validBorrower
            ? [
                {
                    address: ADDRESSES.LENDING_POOL,
                    abi: DASHBOARD_ABI,
                    functionName: 'healthFactor',
                    args: [normalizedBorrower as `0x${string}`],
                },
                {
                    address: ADDRESSES.LENDING_POOL,
                    abi: DASHBOARD_ABI,
                    functionName: 'userBorrowBalance',
                    args: [normalizedBorrower as `0x${string}`, ADDRESSES.USDC],
                },
            ]
            : [],
        query: {
            enabled: validBorrower,
            refetchInterval: 5000,
        },
    });

    const { data: oracleRoundData, isLoading: oracleLoading } = useReadContracts({
        contracts: [
            {
                address: ADDRESSES.WBTC_ORACLE,
                abi: ORACLE_ABI,
                functionName: 'latestRoundData',
            },
        ],
        query: {
            enabled: isConnected,
            refetchInterval: 5000,
        },
    });

    const { data: riskData, isLoading: riskLoading } = useReadContracts({
        contracts: riskContracts,
        query: {
            enabled: isConnected,
            refetchInterval: 8000,
        },
    });

    const healthFactorRay = (borrowerMetrics?.[0]?.result as bigint | undefined) ?? undefined;
    const borrowerUsdcDebt = (borrowerMetrics?.[1]?.result as bigint | undefined) ?? 0n;
    const latestPriceAnswer = (oracleRoundData?.[0]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined)?.[1];
    const currentWbtcPrice = latestPriceAnswer !== undefined ? Number(formatUnits(latestPriceAnswer, 8)) : null;

    const liquidatableCandidates = useMemo(() => {
        if (!riskData?.length) return [];

        const list: Array<{
            address: string;
            healthFactor: number;
            wbtcCollateral: bigint;
            usdcDebt: bigint;
            maxRepay: bigint;
        }> = [];

        for (let i = 0; i < riskAddresses.length; i += 1) {
            const base = i * 3;
            const hf = riskData[base]?.result as bigint | undefined;
            const collateral = riskData[base + 1]?.result as bigint | undefined;
            const debt = riskData[base + 2]?.result as bigint | undefined;

            if (hf === undefined || collateral === undefined || debt === undefined) continue;

            const hfNumber = Number(formatUnits(hf, 27));
            if (hfNumber > 0 && hfNumber < 1 && collateral > 0n && debt > 0n) {
                list.push({
                    address: riskAddresses[i],
                    healthFactor: hfNumber,
                    wbtcCollateral: collateral,
                    usdcDebt: debt,
                    maxRepay: debt / 2n,
                });
            }
        }

        return list.sort((a, b) => a.healthFactor - b.healthFactor);
    }, [riskData, riskAddresses]);

    const healthFactor = healthFactorRay ? Number(formatUnits(healthFactorRay, 27)) : null;
    const maxRepayEstimate = borrowerUsdcDebt / 2n;
    const canBeLiquidated = healthFactor !== null && healthFactor > 0 && healthFactor < 1;

    const copyAddress = async (value: string) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedAddress(value);
            window.setTimeout(() => setCopiedAddress(null), 1500);
        } catch {
            alert('复制失败，请手动复制');
        }
    };

    useEffect(() => {
        if (!publicClient) return;

        let cancelled = false;

        const loadRecentLiquidations = async () => {
            setIsLoadingRecords(true);
            try {
                const latest = await publicClient.getBlockNumber();
                const fromBlock = latest > 2500n ? latest - 2500n : 0n;
                const logs = await publicClient.getLogs({
                    address: ADDRESSES.LENDING_POOL,
                    event: LIQUIDATED_EVENT,
                    fromBlock,
                    toBlock: 'latest',
                });

                if (cancelled) return;

                const parsed = [...logs]
                    .reverse()
                    .slice(0, 8)
                    .map((log) => ({
                        txHash: log.transactionHash,
                        blockNumber: log.blockNumber ?? 0n,
                        liquidator: (log.args.liquidator ?? '') as string,
                        borrower: (log.args.borrower ?? '') as string,
                        repaidAmount: (log.args.repaidAmount ?? 0n) as bigint,
                        seizedAmount: (log.args.seizedAmount ?? 0n) as bigint,
                    }));

                setRecords(parsed);
            } catch {
                if (!cancelled) {
                    setRecords([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingRecords(false);
                }
            }
        };

        loadRecentLiquidations();
        const timer = window.setInterval(loadRecentLiquidations, 12000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [publicClient]);

    const handleLiquidate = () => {
        if (!validBorrower || !parsedRepayAmount) {
            alert('请填写正确的借款人地址和偿还金额');
            return;
        }

        // 使用USDC作为债务资产，WBTC作为抵押资产
        writeLiquidation({
            address: ADDRESSES.LENDING_POOL as `0x${string}`,
            abi: DASHBOARD_ABI,
            functionName: 'liquidate',
            args: [
                normalizedBorrower as `0x${string}`,
                ADDRESSES.USDC as `0x${string}`,
                ADDRESSES.WBTC as `0x${string}`,
                parsedRepayAmount,
                BigInt(0) // 最小扣押金额为0
            ],
        });
    };

    const handleUpdateWbtcPrice = (targetPrice: string) => {
        if (!isPriceAdmin) {
            alert('当前钱包没有调价权限，请切换到管理员账户。');
            return;
        }

        writeOracle({
            address: ADDRESSES.WBTC_ORACLE as `0x${string}`,
            abi: ORACLE_ABI,
            functionName: 'updateAnswer',
            args: [parseUnits(targetPrice, 8)],
        });
    };

    const handleApplyCustomPrice = () => {
        if (!customPrice.trim()) {
            alert('请输入目标价格');
            return;
        }
        try {
            const parsed = parseUnits(customPrice, 8);
            if (parsed <= 0n) {
                alert('价格必须大于 0');
                return;
            }
            handleUpdateWbtcPrice(customPrice);
        } catch {
            alert('价格格式不正确');
        }
    };

    if (!isConnected) {
        return (
            <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
                <div className="absolute -top-20 -right-24 h-56 w-56 rounded-full bg-red-500/15 blur-3xl" />
                <div className="absolute -bottom-20 -left-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative mx-auto flex min-h-[360px] max-w-2xl flex-col items-center justify-center gap-5 text-center">
                    <p className="inline-flex rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                        Liquidation Desk
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
                        清算操作台
                    </h1>
                    <p className="max-w-xl text-zinc-300">
                        连接钱包后可查看借款人风险情况、可清算额度，并快速发起清算交易。
                    </p>
                    <ConnectButton />
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-8">
            <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-red-300">Liquidation Desk</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-50">清算工作台</h1>
                        <p className="mt-2 text-sm text-zinc-300">
                            直接查看借款人地址、健康因子与可清算量，减少手动估算。
                        </p>
                    </div>
                    <ConnectButton />
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-zinc-200">链上价格快捷操作</p>
                        <p className="text-xs text-zinc-400">不用切到外部终端，可直接在这里更新 WBTC 预言机价格。</p>
                    </div>
                    <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                        {oracleLoading
                            ? '当前 WBTC: 读取中'
                            : `当前 WBTC: ${currentWbtcPrice ? currentWbtcPrice.toLocaleString('zh-CN') : '--'} USD`}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {PRICE_PRESETS.map((price) => (
                        <button
                            key={price}
                            onClick={() => handleUpdateWbtcPrice(String(price))}
                            disabled={isUpdatingPrice || !isPriceAdmin}
                            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            ${price.toLocaleString('en-US')}
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input
                        type="number"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="自定义价格"
                        className="w-44 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-400"
                    />
                    <button
                        onClick={handleApplyCustomPrice}
                        disabled={isUpdatingPrice || !isPriceAdmin}
                        className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isUpdatingPrice ? '提交中...' : '应用自定义价格'}
                    </button>
                    <button
                        onClick={() => setCustomPrice('30000')}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500"
                    >
                        重置输入为 30000
                    </button>
                </div>

                {oracleError && (
                    <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        价格更新失败: {oracleError.message}
                    </p>
                )}
                <p className={`mt-3 text-xs ${isPriceAdmin ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {isPriceAdmin
                        ? '当前钱包拥有调价权限，可以执行价格更新。'
                        : '当前钱包无调价权限，价格按钮已禁用。请切换管理员账户。'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                    管理员地址: {shortAddress(PRICE_ADMIN_ADDRESSES[0])}
                </p>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-sm text-zinc-400">目标借款人</p>
                    {validBorrower ? (
                        <div className="mt-2 space-y-2">
                            <p className="font-mono text-sm text-zinc-100 break-all">{normalizedBorrower}</p>
                            <button
                                onClick={() => copyAddress(normalizedBorrower)}
                                className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                            >
                                {copiedAddress === normalizedBorrower ? '已复制' : '复制地址'}
                            </button>
                        </div>
                    ) : (
                        <p className="mt-2 text-lg font-semibold text-zinc-100">未输入</p>
                    )}
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-sm text-zinc-400">健康因子</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {healthFactor === null ? '--' : healthFactor.toFixed(4)}
                    </p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-sm text-zinc-400">估算最大清算量 (USDC)</p>
                    <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {validBorrower ? formatUsdc(maxRepayEstimate) : '--'}
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                    <h2 className="text-xl font-semibold text-zinc-100">发起清算</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                        债务资产固定为 USDC，抵押资产固定为 WBTC。
                    </p>

                    <div className="mt-6 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-zinc-300">借款人地址</label>
                            <input
                                type="text"
                                value={borrowerAddress}
                                onChange={(e) => setBorrowerAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100 outline-none transition focus:border-red-400"
                            />
                            {borrowerAddress && !validBorrower && (
                                <p className="mt-2 text-sm text-red-300">地址格式不正确，请检查后再发起清算。</p>
                            )}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-zinc-300">偿还金额 (USDC)</label>
                            <input
                                type="number"
                                value={repayAmount}
                                onChange={(e) => setRepayAmount(e.target.value)}
                                placeholder="例如 1000"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100 outline-none transition focus:border-red-400"
                            />
                            {repayAmount && !parsedRepayAmount && (
                                <p className="mt-2 text-sm text-red-300">请输入大于 0 的有效数字。</p>
                            )}
                        </div>

                        <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">当前债务 (USDC)</span>
                                <span className="font-medium text-zinc-100">
                                    {validBorrower ? formatUsdc(borrowerUsdcDebt) : '--'}
                                </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-zinc-400">建议上限 (50%)</span>
                                <span className="font-medium text-zinc-100">
                                    {validBorrower ? formatUsdc(maxRepayEstimate) : '--'}
                                </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-zinc-400">状态</span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${canBeLiquidated ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                    {borrowerMetricsLoading
                                        ? '读取中'
                                        : canBeLiquidated
                                            ? '可清算'
                                            : '暂不可清算'}
                                </span>
                            </div>
                        </div>

                        {liquidationError && (
                            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                                {liquidationError.message}
                            </div>
                        )}

                        <button
                            onClick={handleLiquidate}
                            disabled={
                                isLiquidating ||
                                !validBorrower ||
                                !parsedRepayAmount ||
                                (maxRepayEstimate > 0n && parsedRepayAmount > maxRepayEstimate)
                            }
                            className="w-full rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLiquidating ? '提交中...' : '执行清算'}
                        </button>
                        {parsedRepayAmount && maxRepayEstimate > 0n && parsedRepayAmount > maxRepayEstimate && (
                            <p className="text-sm text-amber-300">
                                输入金额超过估算上限（50% 债务），交易可能失败。
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-zinc-100">可清算地址列表 (HF &lt; 1)</h2>
                        <span className="text-xs text-zinc-400">自动扫描常用测试地址</span>
                    </div>

                    {riskLoading ? (
                        <p className="text-sm text-zinc-400">正在扫描可清算地址...</p>
                    ) : liquidatableCandidates.length === 0 ? (
                        <p className="text-sm text-zinc-400">当前未发现健康因子低于 1 的可清算仓位。</p>
                    ) : (
                        <div className="space-y-3">
                            {liquidatableCandidates.map((candidate) => (
                                <div key={candidate.address} className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm text-zinc-400">借款人地址</p>
                                        <div className="flex items-center gap-2">
                                            <p title={candidate.address} className="font-mono text-sm text-zinc-100">{shortAddress(candidate.address)}</p>
                                            <button
                                                onClick={() => copyAddress(candidate.address)}
                                                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                                            >
                                                {copiedAddress === candidate.address ? '已复制' : '复制'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setBorrowerAddress(candidate.address);
                                                    setRepayAmount(formatUnits(candidate.maxRepay, 6));
                                                }}
                                                className="rounded-md border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25"
                                            >
                                                设为清算目标
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">{candidate.address}</p>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                        <div className="rounded-md border border-zinc-700 p-2">
                                            <p className="text-zinc-400">健康因子</p>
                                            <p className="mt-1 font-semibold text-red-300">{candidate.healthFactor.toFixed(4)}</p>
                                        </div>
                                        <div className="rounded-md border border-zinc-700 p-2">
                                            <p className="text-zinc-400">WBTC 抵押</p>
                                            <p className="mt-1 font-semibold text-zinc-100">{Number(formatUnits(candidate.wbtcCollateral, 8)).toFixed(6)}</p>
                                        </div>
                                        <div className="rounded-md border border-zinc-700 p-2">
                                            <p className="text-zinc-400">建议清算量</p>
                                            <p className="mt-1 font-semibold text-zinc-100">{formatUsdc(candidate.maxRepay)} USDC</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="my-5 border-t border-zinc-800" />

                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-zinc-100">最近正在清算 / 已清算</h2>
                        <span className="text-xs text-zinc-400">链上最近 2500 个区块</span>
                    </div>

                    {isLoadingRecords ? (
                        <p className="text-sm text-zinc-400">正在读取链上清算记录...</p>
                    ) : records.length === 0 ? (
                        <p className="text-sm text-zinc-400">暂无清算记录。你可以先运行价格下跌脚本再回来查看。</p>
                    ) : (
                        <div className="space-y-3">
                            {records.map((record) => (
                                <div key={`${record.txHash}-${record.borrower}`} className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm text-zinc-400">借款人地址</p>
                                        <div className="flex items-center gap-2">
                                            <p title={record.borrower} className="font-mono text-sm text-zinc-100">{shortAddress(record.borrower)}</p>
                                            <button
                                                onClick={() => copyAddress(record.borrower)}
                                                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                                            >
                                                {copiedAddress === record.borrower ? '已复制' : '复制'}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">{record.borrower}</p>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="text-sm text-zinc-400">清算量 (USDC)</p>
                                        <p className="text-sm font-semibold text-red-300">{formatUsdc(record.repaidAmount)}</p>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="text-sm text-zinc-400">扣押量 (WBTC)</p>
                                        <p className="text-sm text-zinc-200">{Number(formatUnits(record.seizedAmount, 8)).toFixed(6)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}