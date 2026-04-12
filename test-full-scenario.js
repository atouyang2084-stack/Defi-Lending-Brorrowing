const { ethers } = require('ethers');

async function main() {
    console.log('完整测试场景：存款 -> 借款 -> 还款\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
    const testAccount = '0x0c78605e5B8eFf915d4782d919a65b56F5337928';

    // 使用测试账户的私钥（需要从MetaMask导出）
    // 注意：在实际测试中，你需要使用测试账户的真实私钥
    // 这里我们使用第一个Hardhat账户来模拟
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(privateKey, provider);

    // ABI
    const lendingPoolAbi = [
        "function getReserveData(address asset) view returns (uint256 totalSupplyScaled, uint256 totalBorrowScaled, uint256 borrowIndex, uint256 protocolReserves, bool isActive)",
        "function userSupplyBalance(address user, address asset) view returns (uint256)",
        "function userBorrowBalance(address user, address asset) view returns (uint256)",
        "function repay(tuple(address asset, uint256 amount, address onBehalfOf) params) returns (uint256)",
        "function borrow(tuple(address asset, uint256 amount, address onBehalfOf) params)",
        "function deposit(tuple(address asset, uint256 amount, address onBehalfOf) params)"
    ];

    const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, wallet);
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, wallet);

    console.log('1. 初始状态检查');
    console.log('----------------');

    // 检查测试账户USDC余额
    const initialBalance = await usdcContract.balanceOf(testAccount);
    console.log('测试账户USDC余额:', ethers.formatUnits(initialBalance, 6), 'USDC');

    // 检查存款和借款余额
    const initialSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
    const initialBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    console.log('测试账户存款余额:', ethers.formatUnits(initialSupply, 6), 'USDC');
    console.log('测试账户借款余额:', ethers.formatUnits(initialBorrow, 6), 'USDC');

    // 检查池子状态
    const reserveData = await lendingPool.getReserveData(usdcAddress);
    const poolUsdcBalance = await usdcContract.balanceOf(lendingPoolAddress);
    console.log('池子USDC余额:', ethers.formatUnits(poolUsdcBalance, 6), 'USDC');
    console.log('协议储备:', ethers.formatUnits(reserveData.protocolReserves, 6), 'USDC');
    console.log('可用流动性:', ethers.formatUnits(poolUsdcBalance - reserveData.protocolReserves, 6), 'USDC');

    console.log('\n2. 授权测试');
    console.log('------------');

    const approveAmount = ethers.parseUnits('1000', 6);
    console.log('授权金额:', ethers.formatUnits(approveAmount, 6), 'USDC');

    try {
        const approveTx = await usdcContract.approve(lendingPoolAddress, approveAmount);
        await approveTx.wait();
        console.log('✅ 授权成功');

        const allowance = await usdcContract.allowance(testAccount, lendingPoolAddress);
        console.log('当前授权额度:', ethers.formatUnits(allowance, 6), 'USDC');
    } catch (error) {
        console.error('❌ 授权失败:', error.message);
        return;
    }

    console.log('\n3. 存款测试');
    console.log('------------');

    const depositAmount = ethers.parseUnits('100', 6);
    console.log('存款金额:', ethers.formatUnits(depositAmount, 6), 'USDC');

    try {
        const depositTx = await lendingPool.deposit({
            asset: usdcAddress,
            amount: depositAmount,
            onBehalfOf: testAccount
        });
        await depositTx.wait();
        console.log('✅ 存款成功');

        // 检查存款后状态
        const afterDepositSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
        console.log('存款后存款余额:', ethers.formatUnits(afterDepositSupply, 6), 'USDC');
    } catch (error) {
        console.error('❌ 存款失败:', error.message);
        return;
    }

    console.log('\n4. 借款测试');
    console.log('------------');

    const borrowAmount = ethers.parseUnits('50', 6);
    console.log('借款金额:', ethers.formatUnits(borrowAmount, 6), 'USDC');

    try {
        const borrowTx = await lendingPool.borrow({
            asset: usdcAddress,
            amount: borrowAmount,
            onBehalfOf: testAccount
        });
        await borrowTx.wait();
        console.log('✅ 借款成功');

        // 检查借款后状态
        const afterBorrowBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
        console.log('借款后借款余额:', ethers.formatUnits(afterBorrowBorrow, 6), 'USDC');
    } catch (error) {
        console.error('❌ 借款失败:', error.message);

        if (error.message.includes('InsufficientLiquidity')) {
            console.log('\n⚠️ InsufficientLiquidity错误！');
            console.log('池子可用流动性不足。');

            // 重新检查池子状态
            const currentPoolBalance = await usdcContract.balanceOf(lendingPoolAddress);
            const currentReserveData = await lendingPool.getReserveData(usdcAddress);
            const availableLiquidity = currentPoolBalance - currentReserveData.protocolReserves;
            console.log('当前可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');
            console.log('尝试借款金额:', ethers.formatUnits(borrowAmount, 6), 'USDC');
        }
        return;
    }

    console.log('\n5. 还款测试');
    console.log('------------');

    const repayAmount = ethers.parseUnits('10', 6);
    console.log('还款金额:', ethers.formatUnits(repayAmount, 6), 'USDC');

    // 检查还款前状态
    const beforeRepayBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    console.log('还款前借款余额:', ethers.formatUnits(beforeRepayBorrow, 6), 'USDC');

    // 检查测试账户USDC余额（用于还款）
    const testAccountBalance = await usdcContract.balanceOf(testAccount);
    console.log('测试账户USDC余额:', ethers.formatUnits(testAccountBalance, 6), 'USDC');

    // 检查授权
    const currentAllowance = await usdcContract.allowance(testAccount, lendingPoolAddress);
    console.log('当前授权额度:', ethers.formatUnits(currentAllowance, 6), 'USDC');

    if (currentAllowance < repayAmount) {
        console.log('⚠️ 授权不足，需要重新授权...');
        try {
            const reapproveTx = await usdcContract.approve(lendingPoolAddress, repayAmount);
            await reapproveTx.wait();
            console.log('✅ 重新授权成功');
        } catch (error) {
            console.error('❌ 重新授权失败:', error.message);
            return;
        }
    }

    try {
        console.log('执行还款交易...');
        const repayTx = await lendingPool.repay({
            asset: usdcAddress,
            amount: repayAmount,
            onBehalfOf: testAccount
        });
        const receipt = await repayTx.wait();
        console.log('✅ 还款成功！');
        console.log('交易哈希:', repayTx.hash);
        console.log('区块:', receipt.blockNumber);

        // 检查还款后状态
        const afterRepayBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
        console.log('还款后借款余额:', ethers.formatUnits(afterRepayBorrow, 6), 'USDC');
        console.log('已还款金额:', ethers.formatUnits(beforeRepayBorrow - afterRepayBorrow, 6), 'USDC');

    } catch (error) {
        console.error('❌ 还款失败:', error.message);

        if (error.message.includes('InsufficientLiquidity')) {
            console.log('\n⚠️ 注意：repay函数不应该抛出InsufficientLiquidity错误！');
            console.log('这可能是合约bug或前端调用了错误的函数。');
        }
    }

    console.log('\n6. 最终状态');
    console.log('------------');

    const finalSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
    const finalBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    const finalBalance = await usdcContract.balanceOf(testAccount);

    console.log('最终存款余额:', ethers.formatUnits(finalSupply, 6), 'USDC');
    console.log('最终借款余额:', ethers.formatUnits(finalBorrow, 6), 'USDC');
    console.log('最终USDC余额:', ethers.formatUnits(finalBalance, 6), 'USDC');
}

main().catch(console.error);