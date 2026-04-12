import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ADDRESSES } from '../web3/addresses';
import erc20ABI from '../web3/abis/ERC20.json';

export default function Faucet() {
    const { address, isConnected } = useAccount();
    const [isMinting, setIsMinting] = useState(false);
    const [mintStatus, setMintStatus] = useState<'idle' | 'minting' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const { data: hash, writeContract, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const handleMint = async () => {
        if (!address || !isConnected) {
            alert('请先连接钱包');
            return;
        }

        setIsMinting(true);
        setMintStatus('minting');
        setErrorMessage('');

        try {
            // 注意：这个函数需要合约有mint权限
            // 实际项目中，你可能需要调用一个专门的水龙头合约
            console.log('正在为地址铸造测试代币:', address);

            // 这里只是示例，实际需要后端API或水龙头合约
            alert('水龙头功能需要后端支持。请使用脚本获取测试代币：\n\n1. 运行: npx hardhat run scripts/mint-to-any-account.js --network localhost\n2. 设置环境变量: TARGET_ADDRESS=' + address);

            setMintStatus('error');
            setErrorMessage('前端水龙头暂不可用，请使用脚本获取测试代币');
        } catch (error: any) {
            console.error('铸造失败:', error);
            setMintStatus('error');
            setErrorMessage(error.message || '未知错误');
        } finally {
            setIsMinting(false);
        }
    };

    const handleCopyCommand = () => {
        if (!address) return;

        const command = `TARGET_ADDRESS=${address} npx hardhat run scripts/mint-to-any-account.js --network localhost`;
        navigator.clipboard.writeText(command)
            .then(() => alert('命令已复制到剪贴板！\n\n在终端中运行此命令即可获取测试代币。'))
            .catch(err => console.error('复制失败:', err));
    };

    if (!isConnected) {
        return (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h3 className="text-blue-800 dark:text-blue-300 font-semibold mb-2">获取测试代币</h3>
                <p className="text-blue-700 dark:text-blue-400 text-sm">
                    请先连接钱包以获取测试代币
                </p>
            </div>
        );
    }

    return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <h3 className="text-green-800 dark:text-green-300 font-semibold mb-2">获取测试代币（水龙头）</h3>

            <div className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>当前地址: <span className="font-mono text-xs">{address}</span></p>
                    <p className="mt-1">每个新账户可以获得:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>10 ETH（Gas费）</li>
                        <li>100,000 USDC</li>
                        <li>1 WBTC</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <button
                        onClick={handleMint}
                        disabled={isMinting || isPending}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                    >
                        {isMinting || isPending ? '处理中...' : '获取测试代币'}
                    </button>

                    <button
                        onClick={handleCopyCommand}
                        className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                    >
                        复制脚本命令
                    </button>
                </div>

                {mintStatus === 'error' && (
                    <div className="text-red-600 text-sm">
                        <p className="font-semibold">错误: {errorMessage}</p>
                        <p className="mt-1">请尝试以下方法：</p>
                        <ol className="list-decimal pl-5 mt-1 space-y-1">
                            <li>确保Hardhat本地节点正在运行</li>
                            <li>运行部署脚本: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npx hardhat run contracts/script/deploy.js --network localhost</code></li>
                            <li>使用脚本获取代币（已复制到剪贴板）</li>
                        </ol>
                    </div>
                )}

                {mintStatus === 'success' && (
                    <div className="text-green-600 text-sm font-semibold">
                        ✅ 测试代币已发送！请检查钱包余额。
                    </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    <p>💡 提示：如果前端水龙头不可用，请使用脚本命令获取测试代币。</p>
                    <p>📖 详细步骤请查看项目文档。</p>
                </div>
            </div>
        </div>
    );
}