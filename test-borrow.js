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

    console.log("\n=== 测试借款 ===");

    // 1. 先尝试借款1 USDC（应该成功）
    const borrowAmount1 = ethers.parseUnits("1", 6);
    console.log("\n尝试借款1 USDC...");

    try {
        const tx1 = await pool.connect(deployer).borrow({
            asset: addresses.USDC,
            amount: borrowAmount1,
            onBehalfOf: deployer.address
        });
        const receipt1 = await tx1.wait();
        console.log("借款1 USDC成功！交易哈希:", receipt1.hash);
    } catch (error) {
        console.log("借款1 USDC失败:", error.message);
    }

    // 2. 检查借款后的状态
    const borrowedBalance = await pool.userBorrowBalance(deployer.address, addresses.USDC);
    console.log("借款后余额:", ethers.formatUnits(borrowedBalance, 6), "USDC");

    // 3. 尝试借款10 USDC（应该失败，因为超过可用流动性）
    const borrowAmount2 = ethers.parseUnits("10", 6);
    console.log("\n尝试借款10 USDC...");

    try {
        const tx2 = await pool.connect(deployer).borrow({
            asset: addresses.USDC,
            amount: borrowAmount2,
            onBehalfOf: deployer.address
        });
        const receipt2 = await tx2.wait();
        console.log("借款10 USDC成功！交易哈希:", receipt2.hash);
    } catch (error) {
        console.log("借款10 USDC失败:", error.message);
        if (error.message.includes("InsufficientLiquidity")) {
            console.log("错误原因: 流动性不足");
        }
    }

    // 4. 检查储备数据
    const reserveData = await pool.getReserveData(addresses.USDC);
    const availableLiquidity = reserveData.totalSupplyScaled - reserveData.totalBorrowScaled - reserveData.protocolReserves;
    console.log("\n当前可用流动性:", ethers.formatUnits(availableLiquidity, 6), "USDC");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});