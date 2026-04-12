const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("测试账户:", deployer.address);

    // 从文件读取地址
    const fs = require("fs");
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 加载合约
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = await LendingPool.attach(addresses.LendingPool);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.attach(addresses.USDC);

    console.log("\n=== 简单还款测试 ===");

    // 1. 确保有足够授权
    console.log("1. 检查授权...");
    const allowance = await usdc.allowance(deployer.address, pool.target);
    if (allowance < ethers.parseUnits("10", 6)) {
        console.log("授权不足，重新授权...");
        const approveTx = await usdc.connect(deployer).approve(pool.target, ethers.MaxUint256);
        await approveTx.wait();
        console.log("授权完成");
    }

    // 2. 直接尝试还款
    console.log("\n2. 尝试还款...");
    const repayAmount = ethers.parseUnits("3", 6);

    try {
        const repayTx = await pool.connect(deployer).repay({
            asset: addresses.USDC,
            amount: repayAmount,
            onBehalfOf: deployer.address
        });

        console.log("还款交易已发送，等待确认...");
        const receipt = await repayTx.wait();
        console.log("还款成功！");
        console.log("交易哈希:", receipt.hash);
        console.log("区块号:", receipt.blockNumber);
    } catch (error) {
        console.log("还款失败:");
        console.log("错误信息:", error.message);

        // 尝试解析错误
        if (error.message.includes("InsufficientLiquidity")) {
            console.log("\n=== 错误分析 ===");
            console.log("错误类型: InsufficientLiquidity()");
            console.log("这个错误通常出现在借款时，表示借贷池流动性不足");
            console.log("但在还款时出现很奇怪，可能的原因:");
            console.log("1. 合约逻辑错误 - repay函数可能调用了错误的检查");
            console.log("2. 错误信息误导 - 实际是其他错误但显示为InsufficientLiquidity");
            console.log("3. 还款金额问题 - 可能还款金额为0或负数");
            console.log("4. 没有借款 - 尝试还款但没有借款余额");
        }
    }

    // 3. 检查USDC余额变化
    console.log("\n3. 检查余额变化...");
    const balanceBefore = await usdc.balanceOf(deployer.address);
    console.log("还款前USDC余额:", ethers.formatUnits(balanceBefore, 6), "USDC");

    // 模拟一个简单的还款（如果上面失败了）
    console.log("\n4. 备用方案: 直接转账到合约...");
    const contractBalanceBefore = await usdc.balanceOf(pool.target);
    console.log("合约USDC余额:", ethers.formatUnits(contractBalanceBefore, 6), "USDC");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});