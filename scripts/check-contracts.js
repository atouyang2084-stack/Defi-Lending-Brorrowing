const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 检查合约状态");
    console.log("================\n");

    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));
    console.log("合约地址:", JSON.stringify(addresses, null, 2));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    try {
        console.log("\n1. 检查USDC合约...");
        const usdc = MockERC20.attach(addresses.USDC);
        const usdcAddress = await usdc.getAddress();
        console.log("USDC地址:", usdcAddress);

        const usdcName = await usdc.name();
        const usdcSymbol = await usdc.symbol();
        const usdcDecimals = await usdc.decimals();
        console.log("USDC名称:", usdcName);
        console.log("USDC符号:", usdcSymbol);
        console.log("USDC小数位:", usdcDecimals);

        // 检查部署者余额
        const deployerBalance = await usdc.balanceOf(deployer.address);
        console.log("部署者USDC余额:", ethers.formatUnits(deployerBalance, usdcDecimals));

    } catch (error) {
        console.log("❌ USDC合约检查失败:", error.message);
    }

    try {
        console.log("\n2. 检查LendingPool合约...");
        const pool = LendingPool.attach(addresses.LendingPool);
        const poolAddress = await pool.getAddress();
        console.log("LendingPool地址:", poolAddress);

        // 检查RAY常量
        const RAY = await pool.RAY();
        console.log("RAY常量:", RAY.toString());

        // 检查USDC配置
        console.log("\n3. 检查USDC配置...");
        const usdc = MockERC20.attach(addresses.USDC);
        const reserveData = await pool.getReserveData(await usdc.getAddress());
        console.log("USDC Reserve Data:", {
            supplyIndex: reserveData.supplyIndex.toString(),
            borrowIndex: reserveData.borrowIndex.toString(),
            totalSupplyScaled: reserveData.totalSupplyScaled.toString(),
            totalBorrowScaled: reserveData.totalBorrowScaled.toString(),
            protocolReserves: reserveData.protocolReserves.toString(),
            lastUpdateTimestamp: reserveData.lastUpdateTimestamp.toString(),
            isActive: reserveData.isActive
        });

    } catch (error) {
        console.log("❌ LendingPool合约检查失败:", error.message);
    }

    try {
        console.log("\n4. 检查WBTC合约...");
        const wbtc = MockERC20.attach(addresses.WBTC);
        const wbtcAddress = await wbtc.getAddress();
        console.log("WBTC地址:", wbtcAddress);

        const wbtcName = await wbtc.name();
        const wbtcSymbol = await wbtc.symbol();
        const wbtcDecimals = await wbtc.decimals();
        console.log("WBTC名称:", wbtcName);
        console.log("WBTC符号:", wbtcSymbol);
        console.log("WBTC小数位:", wbtcDecimals);

    } catch (error) {
        console.log("❌ WBTC合约检查失败:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});