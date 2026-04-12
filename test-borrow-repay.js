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

    console.log("\n=== 完整借款还款测试 ===");

    // 1. 先授权
    console.log("1. 授权...");
    const approveTx = await usdc.connect(deployer).approve(pool.target, ethers.MaxUint256);
    await approveTx.wait();
    console.log("授权完成");

    // 2. 先存款（作为抵押品）
    console.log("\n2. 存款作为抵押品...");
    const depositAmount = ethers.parseUnits("100", 6);
    const depositTx = await pool.connect(deployer).deposit({
        asset: addresses.USDC,
        amount: depositAmount,
        onBehalfOf: deployer.address
    });
    await depositTx.wait();
    console.log("存款完成:", ethers.formatUnits(depositAmount, 6), "USDC");

    // 3. 借款
    console.log("\n3. 借款...");
    const borrowAmount = ethers.parseUnits("3", 6);
    const borrowTx = await pool.connect(deployer).borrow({
        asset: addresses.USDC,
        amount: borrowAmount,
        onBehalfOf: deployer.address
    });
    await borrowTx.wait();
    console.log("借款完成:", ethers.formatUnits(borrowAmount, 6), "USDC");

    // 4. 检查借款后状态
    console.log("\n4. 借款后状态:");
    const borrowedBalance = await pool.userBorrowBalance(deployer.address, addresses.USDC);
    console.log("借款余额:", ethers.formatUnits(borrowedBalance, 6), "USDC");

    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("USDC余额:", ethers.formatUnits(usdcBalance, 6), "USDC");

    // 5. 还款
    console.log("\n5. 还款...");
    const repayAmount = ethers.parseUnits("3", 6);

    try {
        const repayTx = await pool.connect(deployer).repay({
            asset: addresses.USDC,
            amount: repayAmount,
            onBehalfOf: deployer.address
        });

        const receipt = await repayTx.wait();
        console.log("还款成功！交易哈希:", receipt.hash);
        console.log("还款金额:", ethers.formatUnits(repayAmount, 6), "USDC");
    } catch (error) {
        console.log("还款失败:", error.message);
        if (error.message.includes("InsufficientLiquidity")) {
            console.log("错误原因: InsufficientLiquidity");

            // 检查可能的原因
            console.log("\n检查可能的原因:");
            console.log("1. 还款金额:", ethers.formatUnits(repayAmount, 6), "USDC");
            console.log("2. 借款余额:", ethers.formatUnits(borrowedBalance, 6), "USDC");
            console.log("3. USDC余额:", ethers.formatUnits(usdcBalance, 6), "USDC");

            // 检查是否需要重新授权
            const allowance = await usdc.allowance(deployer.address, pool.target);
            console.log("4. 当前授权:", ethers.formatUnits(allowance, 6), "USDC");
        }
    }

    // 6. 最终状态
    console.log("\n6. 最终状态:");
    const borrowedAfter = await pool.userBorrowBalance(deployer.address, addresses.USDC);
    console.log("借款余额:", ethers.formatUnits(borrowedAfter, 6), "USDC");

    const usdcBalanceAfter = await usdc.balanceOf(deployer.address);
    console.log("USDC余额:", ethers.formatUnits(usdcBalanceAfter, 6), "USDC");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});