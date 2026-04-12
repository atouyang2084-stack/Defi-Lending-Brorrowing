const { ethers } = require('ethers');

async function main() {
    console.log('尝试重现前端repay错误...\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
    const testAccount = '0x0c78605e5B8eFf915d4782d919a65b56F5337928';

    // 使用测试账户（需要私钥，这里使用第一个账户模拟）
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(privateKey, provider);

    // 简化ABI
    const lendingPoolAbi = [
        "function repay(tuple(address asset, uint256 amount, address onBehalfOf) params) returns (uint256)",
        "function borrow(tuple(address asset, uint256 amount, address onBehalfOf) params)"
    ];

    const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, wallet);
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, wallet);

    console.log('场景1: 尝试还款但没有借款余额');
    console.log('--------------------------------');

    const repayAmount1 = ethers.parseUnits('10', 6);

    try {
        console.log('尝试还款', ethers.formatUnits(repayAmount1, 6), 'USDC...');
        const tx = await lendingPool.repay({
            asset: usdcAddress,
            amount: repayAmount1,
            onBehalfOf: testAccount
        });
        await tx.wait();
        console.log('✅ 还款成功（不应该发生，因为没有借款余额）');
    } catch (error) {
        console.log('❌ 还款失败（预期中）');
        console.log('错误信息:', error.message);

        if (error.message.includes('InsufficientLiquidity')) {
            console.log('⚠️ 出现了InsufficientLiquidity错误！');
            console.log('但repay函数不应该抛出这个错误。');
        }
    }

    console.log('\n场景2: 先授权然后尝试还款');
    console.log('--------------------------');

    // 先授权
    try {
        const approveAmount = ethers.parseUnits('100', 6);
        console.log('授权', ethers.formatUnits(approveAmount, 6), 'USDC...');
        const approveTx = await usdcContract.approve(lendingPoolAddress, approveAmount);
        await approveTx.wait();
        console.log('✅ 授权成功');
    } catch (error) {
        console.log('❌ 授权失败:', error.message);
    }

    // 再次尝试还款
    try {
        console.log('\n再次尝试还款', ethers.formatUnits(repayAmount1, 6), 'USDC...');
        const tx = await lendingPool.repay({
            asset: usdcAddress,
            amount: repayAmount1,
            onBehalfOf: testAccount
        });
        await tx.wait();
        console.log('✅ 还款成功');
    } catch (error) {
        console.log('❌ 还款失败');
        console.log('错误信息:', error.message);

        if (error.message.includes('InsufficientLiquidity')) {
            console.log('⚠️ 再次出现InsufficientLiquidity错误！');
            console.log('这证实了问题：repay函数抛出了不应该出现的错误。');
        }
    }

    console.log('\n场景3: 尝试借款（对比）');
    console.log('----------------------');

    const borrowAmount = ethers.parseUnits('100', 6);

    try {
        console.log('尝试借款', ethers.formatUnits(borrowAmount, 6), 'USDC...');
        const tx = await lendingPool.borrow({
            asset: usdcAddress,
            amount: borrowAmount,
            onBehalfOf: testAccount
        });
        await tx.wait();
        console.log('✅ 借款成功');
    } catch (error) {
        console.log('❌ 借款失败');
        console.log('错误信息:', error.message);

        if (error.message.includes('InsufficientLiquidity')) {
            console.log('✅ 正确：borrow函数抛出了InsufficientLiquidity错误');
            console.log('因为池子可用流动性不足。');

            // 检查池子流动性
            const poolBalance = await usdcContract.balanceOf(lendingPoolAddress);
            console.log('池子USDC余额:', ethers.formatUnits(poolBalance, 6), 'USDC');
        }
    }

    console.log('\n结论:');
    console.log('1. repay函数不应该抛出InsufficientLiquidity错误');
    console.log('2. 如果前端在repay时收到这个错误，可能是：');
    console.log('   a) 前端实际上调用了borrow函数');
    console.log('   b) 合约有bug');
    console.log('   c) 错误信息被错误解析');
}

main().catch(console.error);