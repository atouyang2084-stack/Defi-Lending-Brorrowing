const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 计算最小存款金额");
    console.log("===================\n");

    const [deployer] = await ethers.getSigners();

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    // 获取reserve数据
    const reserveData = await pool.getReserveData(await usdc.getAddress());
    const RAY = 1000000000000000000000000000n; // 1e27

    console.log("USDC Reserve数据:");
    console.log(`supplyIndex: ${reserveData.supplyIndex.toString()}`);
    console.log(`RAY: ${RAY.toString()}`);

    // 计算最小存款金额：scaled必须 > 0
    // scaled = (amount * RAY) / supplyIndex > 0
    // => amount > 0 且 amount * RAY > supplyIndex
    // 实际上 scaled > 0 意味着 amount * RAY >= supplyIndex
    // 所以最小 amount = ceil(supplyIndex / RAY)

    const minDepositWei = (reserveData.supplyIndex + RAY - 1n) / RAY;
    const minDepositUsdc = ethers.formatUnits(minDepositWei, 6);

    console.log(`\n最小存款金额:`);
    console.log(`wei: ${minDepositWei.toString()}`);
    console.log(`USDC: ${minDepositUsdc} USDC`);

    // 测试几个不同的金额
    console.log("\n测试不同存款金额:");
    const testAmounts = [
        ethers.parseUnits("0.000001", 6),  // 0.000001 USDC
        ethers.parseUnits("0.001", 6),     // 0.001 USDC
        ethers.parseUnits("0.01", 6),      // 0.01 USDC
        ethers.parseUnits("0.1", 6),       // 0.1 USDC
        ethers.parseUnits("1", 6),         // 1 USDC
        ethers.parseUnits(minDepositUsdc, 6), // 最小金额
        ethers.parseUnits("10", 6),        // 10 USDC
    ];

    for (const amount of testAmounts) {
        const scaled = (amount * RAY) / reserveData.supplyIndex;
        console.log(`\n${ethers.formatUnits(amount, 6)} USDC:`);
        console.log(`  amount: ${amount}`);
        console.log(`  scaled: ${scaled}`);
        console.log(`  scaled > 0: ${scaled > 0n}`);

        if (scaled === 0n) {
            console.log(`  ❌ 这个金额太小，会导致 scaled = 0`);
        } else {
            console.log(`  ✅ 这个金额可以存款`);
        }
    }

    // 检查当前supplyIndex的值
    console.log(`\n当前supplyIndex: ${reserveData.supplyIndex}`);
    console.log(`RAY: ${RAY}`);
    console.log(`supplyIndex / RAY = ${reserveData.supplyIndex / RAY}`);
    console.log(`这意味着每个scaled单位代表 ${ethers.formatUnits(reserveData.supplyIndex / RAY, 6)} USDC`);

    // 建议
    console.log("\n💡 建议:");
    console.log(`1. 存款金额至少为 ${minDepositUsdc} USDC`);
    console.log(`2. 建议存款 ${Math.max(1, parseFloat(minDepositUsdc) * 2).toFixed(6)} USDC 或更多`);
    console.log(`3. 如果你在前端输入了小于 ${minDepositUsdc} USDC 的金额，会导致算术溢出错误`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});