const { ethers } = require('ethers');

async function main() {
    console.log('检查新部署的合约状态...\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

    // 新地址
    const usdcAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
    const lendingPoolAddress = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';
    const testAccount = '0x0c78605e5B8eFf915d4782d919a65b56F5337928';

    // ABI
    const lendingPoolAbi = [
        "function getReserveData(address asset) view returns (uint256 totalSupplyScaled, uint256 totalBorrowScaled, uint256 borrowIndex, uint256 protocolReserves, bool isActive)",
        "function userSupplyBalance(address user, address asset) view returns (uint256)",
        "function userBorrowBalance(address user, address asset) view returns (uint256)"
    ];

    const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, provider);
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);

    console.log('1. 检查测试账户余额');
    console.log('-------------------');

    const testAccountUsdcBalance = await usdcContract.balanceOf(testAccount);
    console.log('测试账户USDC余额:', ethers.formatUnits(testAccountUsdcBalance, 6), 'USDC');

    console.log('\n2. 检查池子状态');
    console.log('---------------');

    const poolUsdcBalance = await usdcContract.balanceOf(lendingPoolAddress);
    console.log('池子USDC余额:', ethers.formatUnits(poolUsdcBalance, 6), 'USDC');

    const reserveData = await lendingPool.getReserveData(usdcAddress);
    console.log('储备数据:');
    console.log('- totalSupplyScaled:', reserveData.totalSupplyScaled.toString());
    console.log('- totalBorrowScaled:', reserveData.totalBorrowScaled.toString());
    console.log('- borrowIndex:', reserveData.borrowIndex.toString());
    console.log('- protocolReserves:', ethers.formatUnits(reserveData.protocolReserves, 6), 'USDC');
    console.log('- isActive:', reserveData.isActive);

    console.log('\n3. 检查测试账户存款和借款');
    console.log('------------------------');

    const userSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
    const userBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    console.log('存款余额:', ethers.formatUnits(userSupply, 6), 'USDC');
    console.log('借款余额:', ethers.formatUnits(userBorrow, 6), 'USDC');

    console.log('\n4. 计算可用流动性');
    console.log('-----------------');

    const availableLiquidity = poolUsdcBalance - reserveData.protocolReserves;
    console.log('可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');

    console.log('\n5. 测试错误场景');
    console.log('---------------');

    // 测试借款（应该失败，因为池子是空的）
    console.log('测试借款10 USDC...');
    try {
        const borrowAbi = ["function borrow(tuple(address asset, uint256 amount, address onBehalfOf) params)"];
        const borrowContract = new ethers.Contract(lendingPoolAddress, borrowAbi, provider);

        // 使用staticCall模拟
        await borrowContract.borrow.staticCall({
            asset: usdcAddress,
            amount: ethers.parseUnits('10', 6),
            onBehalfOf: testAccount
        });
        console.log('✅ 借款成功（不应该发生）');
    } catch (error) {
        console.log('❌ 借款失败（预期中）');
        console.log('错误信息:', error.message);

        if (error.message.includes('InsufficientLiquidity')) {
            console.log('✅ 正确收到了InsufficientLiquidity错误');
        }
    }

    console.log('\n状态总结:');
    console.log('---------');
    console.log('1. 测试账户有', ethers.formatUnits(testAccountUsdcBalance, 6), 'USDC');
    console.log('2. 池子有', ethers.formatUnits(poolUsdcBalance, 6), 'USDC');
    console.log('3. 可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');
    console.log('4. 测试账户没有存款和借款');
    console.log('\n要测试还款，需要先：');
    console.log('1. 存款一些USDC到池子');
    console.log('2. 借款一些USDC');
    console.log('3. 然后才能还款');
}

main().catch(console.error);