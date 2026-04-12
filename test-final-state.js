const { ethers } = require('ethers');

async function main() {
    console.log('测试最终状态...\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

    // 最新地址
    const usdcAddress = '0xCD8a1C3ba11CF5ECfa6267617243239504a98d90';
    const lendingPoolAddress = '0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650';
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

    console.log('1. 基本状态检查');
    console.log('----------------');

    const testAccountUsdcBalance = await usdcContract.balanceOf(testAccount);
    console.log('测试账户USDC余额:', ethers.formatUnits(testAccountUsdcBalance, 6), 'USDC');

    const poolUsdcBalance = await usdcContract.balanceOf(lendingPoolAddress);
    console.log('池子USDC余额:', ethers.formatUnits(poolUsdcBalance, 6), 'USDC');

    console.log('\n2. 储备数据检查');
    console.log('---------------');

    const reserveData = await lendingPool.getReserveData(usdcAddress);
    console.log('储备数据:');
    console.log('- totalSupplyScaled:', reserveData.totalSupplyScaled.toString());
    console.log('- totalBorrowScaled:', reserveData.totalBorrowScaled.toString());
    console.log('- borrowIndex:', reserveData.borrowIndex.toString());
    console.log('- protocolReserves:', ethers.formatUnits(reserveData.protocolReserves, 6), 'USDC');
    console.log('- isActive:', reserveData.isActive);

    console.log('\n3. 用户状态检查');
    console.log('---------------');

    const userSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
    const userBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    console.log('存款余额:', ethers.formatUnits(userSupply, 6), 'USDC');
    console.log('借款余额:', ethers.formatUnits(userBorrow, 6), 'USDC');

    console.log('\n4. 测试存款');
    console.log('-----------');

    if (userSupply === 0n && testAccountUsdcBalance > 0n) {
        console.log('测试账户有USDC但没有存款，可以测试存款。');

        // 使用第一个账户来发送交易（模拟测试账户）
        const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(privateKey, provider);

        const depositLendingPool = new ethers.Contract(lendingPoolAddress, [
            "function deposit(tuple(address asset, uint256 amount, address onBehalfOf) params)"
        ], wallet);

        const depositUsdcContract = new ethers.Contract(usdcAddress, [
            "function approve(address spender, uint256 amount) returns (bool)"
        ], wallet);

        const depositAmount = ethers.parseUnits('100', 6);

        try {
            console.log('1. 授权...');
            const approveTx = await depositUsdcContract.approve(lendingPoolAddress, depositAmount);
            await approveTx.wait();
            console.log('✅ 授权成功');

            console.log('2. 存款...');
            const depositTx = await depositLendingPool.deposit({
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
            console.error('存款失败:', error.message);
        }
    }

    console.log('\n5. 测试借款');
    console.log('-----------');

    // 检查当前借款余额
    const currentBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    if (currentBorrow === 0n) {
        console.log('测试账户没有借款，可以测试借款。');

        // 检查池子可用流动性
        const currentPoolBalance = await usdcContract.balanceOf(lendingPoolAddress);
        const currentReserveData = await lendingPool.getReserveData(usdcAddress);
        const availableLiquidity = currentPoolBalance - currentReserveData.protocolReserves;

        console.log('当前可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');

        if (availableLiquidity > 0n) {
            const borrowAmount = ethers.parseUnits('10', 6);

            if (borrowAmount <= availableLiquidity) {
                console.log('尝试借款', ethers.formatUnits(borrowAmount, 6), 'USDC...');

                try {
                    const borrowLendingPool = new ethers.Contract(lendingPoolAddress, [
                        "function borrow(tuple(address asset, uint256 amount, address onBehalfOf) params)"
                    ], new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider));

                    const borrowTx = await borrowLendingPool.borrow({
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
                    console.error('借款失败:', error.message);

                    if (error.message.includes('InsufficientLiquidity')) {
                        console.log('⚠️ 收到了InsufficientLiquidity错误');
                    }
                }
            } else {
                console.log('借款金额超过可用流动性');
            }
        } else {
            console.log('池子没有可用流动性');
        }
    }

    console.log('\n6. 测试还款');
    console.log('-----------');

    // 检查当前借款余额
    const finalBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    if (finalBorrow > 0n) {
        console.log('测试账户有借款余额:', ethers.formatUnits(finalBorrow, 6), 'USDC');
        console.log('可以测试还款。');

        const repayAmount = ethers.parseUnits('5', 6); // 还款5 USDC

        try {
            const repayLendingPool = new ethers.Contract(lendingPoolAddress, [
                "function repay(tuple(address asset, uint256 amount, address onBehalfOf) params) returns (uint256)"
            ], new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider));

            console.log('尝试还款', ethers.formatUnits(repayAmount, 6), 'USDC...');
            const repayTx = await repayLendingPool.repay({
                asset: usdcAddress,
                amount: repayAmount,
                onBehalfOf: testAccount
            });
            await repayTx.wait();
            console.log('✅ 还款成功');

            // 检查还款后状态
            const afterRepayBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
            console.log('还款后借款余额:', ethers.formatUnits(afterRepayBorrow, 6), 'USDC');

        } catch (error) {
            console.error('还款失败:', error.message);

            if (error.message.includes('InsufficientLiquidity')) {
                console.log('❌ 注意：repay函数不应该抛出InsufficientLiquidity错误！');
                console.log('这可能意味着：');
                console.log('1. 前端实际上调用了borrow函数');
                console.log('2. 合约有bug');
                console.log('3. 错误信息被误解');
            }
        }
    } else {
        console.log('测试账户没有借款余额，无法测试还款。');
    }

    console.log('\n最终状态:');
    console.log('---------');
    const finalSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
    const finalBorrowAfter = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    const finalBalance = await usdcContract.balanceOf(testAccount);

    console.log('存款余额:', ethers.formatUnits(finalSupply, 6), 'USDC');
    console.log('借款余额:', ethers.formatUnits(finalBorrowAfter, 6), 'USDC');
    console.log('USDC余额:', ethers.formatUnits(finalBalance, 6), 'USDC');
}

main().catch(console.error);