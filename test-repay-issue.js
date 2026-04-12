const { ethers } = require('ethers');

async function main() {
    console.log('测试还款问题...');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
    const testAccount = '0x0c78605e5B8eFf915d4782d919a65b56F5337928';

    // 获取私钥（从Hardhat默认账户）
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // 第一个账户的私钥
    const wallet = new ethers.Wallet(privateKey, provider);

    // LendingPool ABI（简化版）
    const lendingPoolAbi = [
        "function getReserveData(address asset) view returns (uint256 totalSupplyScaled, uint256 totalBorrowScaled, uint256 borrowIndex, uint256 protocolReserves, bool isActive)",
        "function userSupplyBalance(address user, address asset) view returns (uint256)",
        "function userBorrowBalance(address user, address asset) view returns (uint256)",
        "function repay(tuple(address asset, uint256 amount, address onBehalfOf) params) returns (uint256)",
        "function borrow(tuple(address asset, uint256 amount, address onBehalfOf) params)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, wallet);

    // 检查测试账户的借款余额
    const userBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    console.log('测试账户借款余额:', ethers.formatUnits(userBorrow, 6), 'USDC');

    if (userBorrow === 0n) {
        console.log('\n⚠️ 测试账户没有借款余额，无法测试还款！');
        console.log('需要先借款才能测试还款。');

        // 检查测试账户是否有存款
        const userSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
        console.log('测试账户存款余额:', ethers.formatUnits(userSupply, 6), 'USDC');

        if (userSupply === 0n) {
            console.log('\n测试账户也没有存款，需要先存款才能借款。');

            // 检查测试账户USDC余额
            const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];
            const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);
            const testAccountUsdcBalance = await usdcContract.balanceOf(testAccount);
            console.log('测试账户USDC余额:', ethers.formatUnits(testAccountUsdcBalance, 6), 'USDC');

            if (testAccountUsdcBalance === 0n) {
                console.log('\n❌ 测试账户USDC余额为0！');
                console.log('请先运行 setup-test-account-fixed.js 脚本为测试账户铸造USDC。');
                return;
            }
        }
    } else {
        console.log('\n测试账户有借款余额，可以测试还款。');

        // 尝试还款1 USDC
        const repayAmount = ethers.parseUnits('1', 6);
        console.log('尝试还款:', ethers.formatUnits(repayAmount, 6), 'USDC');

        try {
            // 先检查授权
            const erc20Abi = [
                "function balanceOf(address owner) view returns (uint256)",
                "function allowance(address owner, address spender) view returns (uint256)"
            ];
            const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, wallet);

            const allowance = await usdcContract.allowance(testAccount, lendingPoolAddress);
            console.log('授权额度:', ethers.formatUnits(allowance, 6), 'USDC');

            if (allowance < repayAmount) {
                console.log('⚠️ 授权不足，需要先授权。');
                return;
            }

            // 检查测试账户USDC余额
            const testAccountUsdcBalance = await usdcContract.balanceOf(testAccount);
            console.log('测试账户USDC余额:', ethers.formatUnits(testAccountUsdcBalance, 6), 'USDC');

            if (testAccountUsdcBalance < repayAmount) {
                console.log('❌ 余额不足！');
                return;
            }

            console.log('执行还款交易...');
            const tx = await lendingPool.repay({
                asset: usdcAddress,
                amount: repayAmount,
                onBehalfOf: testAccount
            });

            console.log('交易已发送:', tx.hash);
            const receipt = await tx.wait();
            console.log('交易确认，区块:', receipt.blockNumber);

        } catch (error) {
            console.error('还款失败:', error.message);

            if (error.message.includes('InsufficientLiquidity')) {
                console.log('\n❌ InsufficientLiquidity错误！');
                console.log('这可能是因为：');
                console.log('1. 池子流动性不足（但还款应该不需要池子流动性）');
                console.log('2. 合约内部错误');

                // 检查池子状态
                const reserveData = await lendingPool.getReserveData(usdcAddress);
                console.log('\n池子状态:');
                console.log('- protocolReserves:', ethers.formatUnits(reserveData.protocolReserves, 6), 'USDC');

                const usdcContract = new ethers.Contract(usdcAddress, ["function balanceOf(address owner) view returns (uint256)"], provider);
                const poolUsdcBalance = await usdcContract.balanceOf(lendingPoolAddress);
                console.log('- 池子USDC余额:', ethers.formatUnits(poolUsdcBalance, 6), 'USDC');
            }
        }
    }
}

main().catch(console.error);