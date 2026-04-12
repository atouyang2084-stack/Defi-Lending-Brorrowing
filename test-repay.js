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

    console.log("\n=== 测试还款 ===");

    // 1. 先检查当前状态
    const borrowedBalance = await pool.userBorrowBalance(deployer.address, addresses.USDC);
    console.log("当前借款余额:", ethers.formatUnits(borrowedBalance, 6), "USDC");

    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("USDC余额:", ethers.formatUnits(usdcBalance, 6), "USDC");

    // 2. 检查授权
    const allowance = await usdc.allowance(deployer.address, pool.target);
    console.log("当前授权:", ethers.formatUnits(allowance, 6), "USDC");

    // 3. 如果需要，先授权
    if (allowance < ethers.parseUnits("3", 6)) {
        console.log("授权中...");
        const tx = await usdc.connect(deployer).approve(pool.target, ethers.MaxUint256);
        await tx.wait();
        console.log("授权完成");
    }

    // 4. 尝试还款
    const repayAmount = ethers.parseUnits("3", 6);
    console.log("\n尝试还款:", ethers.formatUnits(repayAmount, 6), "USDC");

    try {
        const tx = await pool.connect(deployer).repay({
            asset: addresses.USDC,
            amount: repayAmount,
            onBehalfOf: deployer.address
        });

        const receipt = await tx.wait();
        console.log("还款成功！交易哈希:", receipt.hash);
    } catch (error) {
        console.log("还款失败:", error.message);
        if (error.message.includes("InsufficientLiquidity")) {
            console.log("错误原因: InsufficientLiquidity");
            console.log("这很奇怪，因为还款应该增加流动性，而不是消耗流动性");
        }
    }

    // 5. 检查还款后状态
    const borrowedAfter = await pool.userBorrowBalance(deployer.address, addresses.USDC);
    console.log("还款后借款余额:", ethers.formatUnits(borrowedAfter, 6), "USDC");

    const usdcBalanceAfter = await usdc.balanceOf(deployer.address);
    console.log("还款后USDC余额:", ethers.formatUnits(usdcBalanceAfter, 6), "USDC");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});