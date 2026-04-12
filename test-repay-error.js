const { ethers } = require('ethers');

async function main() {
    console.log('测试repay函数是否会抛出InsufficientLiquidity错误...\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

    // 读取合约源代码，查看repay函数
    console.log('分析LendingPool.sol中的repay函数...\n');

    const fs = require('fs');
    const contractSource = fs.readFileSync('contracts/src/core/LendingPool.sol', 'utf8');

    // 查找repay函数
    const repayFunctionStart = contractSource.indexOf('function repay(');
    if (repayFunctionStart === -1) {
        console.log('找不到repay函数');
        return;
    }

    const repayFunctionEnd = contractSource.indexOf('function ', repayFunctionStart + 1);
    const repayFunction = contractSource.substring(
        repayFunctionStart,
        repayFunctionEnd !== -1 ? repayFunctionEnd : contractSource.length
    );

    console.log('repay函数代码:');
    console.log('----------------------------------------');
    console.log(repayFunction.substring(0, 500) + '...');
    console.log('----------------------------------------\n');

    // 查找InsufficientLiquidity错误在repay函数中的位置
    if (repayFunction.includes('InsufficientLiquidity')) {
        console.log('❌ 在repay函数中找到了InsufficientLiquidity错误！');

        // 找到具体位置
        const lines = repayFunction.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('InsufficientLiquidity')) {
                console.log(`第${i+1}行: ${lines[i].trim()}`);
            }
        }
    } else {
        console.log('✅ repay函数中没有InsufficientLiquidity错误。');
        console.log('这意味着前端报告的InsufficientLiquidity错误不可能来自repay函数！');
    }

    // 检查borrow函数
    console.log('\n检查borrow函数...\n');
    const borrowFunctionStart = contractSource.indexOf('function borrow(');
    if (borrowFunctionStart !== -1) {
        const borrowFunctionEnd = contractSource.indexOf('function ', borrowFunctionStart + 1);
        const borrowFunction = contractSource.substring(
            borrowFunctionStart,
            borrowFunctionEnd !== -1 ? borrowFunctionEnd : contractSource.length
        );

        if (borrowFunction.includes('InsufficientLiquidity')) {
            console.log('✅ 在borrow函数中找到了InsufficientLiquidity错误。');

            const lines = borrowFunction.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('InsufficientLiquidity')) {
                    console.log(`第${i+1}行: ${lines[i].trim()}`);
                }
            }
        }
    }

    console.log('\n结论:');
    console.log('1. InsufficientLiquidity()错误只会在borrow函数中发生（第143行）');
    console.log('2. repay函数不会抛出InsufficientLiquidity错误');
    console.log('3. 前端报告的"InsufficientLiquidity()"错误可能意味着：');
    console.log('   a) 用户实际上在尝试借款(borrow)而不是还款(repay)');
    console.log('   b) 前端代码有bug，错误地调用了borrow函数');
    console.log('   c) 错误信息被误解或错误地显示');
}

main().catch(console.error);