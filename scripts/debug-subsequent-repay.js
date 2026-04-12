const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 诊断后续repay无变化问题");
    console.log("==============================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 检查当前状态:");
    const initialBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const initialUsdcBalance = await usdc.balanceOf(user.address);
    const initialAllowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(initialBorrowBalance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(initialUsdcBalance, 6), "USDC");
    console.log("   当前授权:", ethers.formatUnits(initialAllowance, 6), "USDC");

    console.log("\n2. 模拟第一次repay（假设成功）:");
    const repayAmount = ethers.parseUnits("1", 6);

    // 检查授权是否足够
    if (initialAllowance < repayAmount) {
        console.log("   授权不足，先授权...");
        await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
        console.log("   ✅ 授权完成");
    }

    console.log("   执行第一次repay...");
    const repayParams = {
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    };

    try {
        const tx1 = await pool.connect(user).repay(repayParams);
        console.log("   ✅ 第一次repay交易已发送:", tx1.hash);

        const receipt1 = await tx1.wait();
        console.log("   ✅ 第一次repay成功，区块:", receipt1.blockNumber);
    } catch (error) {
        console.log("   ❌ 第一次repay失败:", error.message);
        return;
    }

    console.log("\n3. 检查第一次repay后的状态:");
    const afterFirstBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const afterFirstUsdcBalance = await usdc.balanceOf(user.address);
    const afterFirstAllowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(afterFirstBorrowBalance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(afterFirstUsdcBalance, 6), "USDC");
    console.log("   剩余授权:", ethers.formatUnits(afterFirstAllowance, 6), "USDC");

    console.log("\n4. 模拟第二次repay（用户说无变化）:");

    // 检查剩余授权是否足够
    if (afterFirstAllowance < repayAmount) {
        console.log("   ⚠️ 剩余授权不足！需要:", ethers.formatUnits(repayAmount, 6), "USDC");
        console.log("   剩余:", ethers.formatUnits(afterFirstAllowance, 6), "USDC");
        console.log("   这是可能的原因：授权额度用完了");

        // 尝试再次授权
        console.log("   尝试再次授权...");
        await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
        console.log("   ✅ 再次授权完成");
    } else {
        console.log("   ✅ 剩余授权足够");
    }

    console.log("   执行第二次repay...");
    try {
        const tx2 = await pool.connect(user).repay(repayParams);
        console.log("   ✅ 第二次repay交易已发送:", tx2.hash);

        const receipt2 = await tx2.wait();
        console.log("   ✅ 第二次repay成功，区块:", receipt2.blockNumber);
    } catch (error) {
        console.log("   ❌ 第二次repay失败:", error.message);
        if (error.reason) {
            console.log("   错误原因:", error.reason);
        }
        return;
    }

    console.log("\n5. 检查第二次repay后的状态:");
    const afterSecondBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const afterSecondUsdcBalance = await usdc.balanceOf(user.address);
    const afterSecondAllowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(afterSecondBorrowBalance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(afterSecondUsdcBalance, 6), "USDC");
    console.log("   剩余授权:", ethers.formatUnits(afterSecondAllowance, 6), "USDC");

    console.log("\n6. 分析可能的问题:");

    // 计算变化
    const borrowChange1 = initialBorrowBalance - afterFirstBorrowBalance;
    const borrowChange2 = afterFirstBorrowBalance - afterSecondBorrowBalance;

    console.log("   第一次repay减少的借款:", ethers.formatUnits(borrowChange1, 6), "USDC");
    console.log("   第二次repay减少的借款:", ethers.formatUnits(borrowChange2, 6), "USDC");

    if (borrowChange2 === 0n) {
        console.log("\n   🔍 发现：第二次repay没有减少借款！");
        console.log("   可能原因：");
        console.log("   1. 还款金额太小，被利息抵消了");
        console.log("   2. 合约计算有舍入误差");
        console.log("   3. 前端显示的是缓存数据，没有刷新");

        // 检查利息
        console.log("\n   检查利息影响:");
        const reserveData = await pool.getReserveData(await usdc.getAddress());
        console.log("   借款指数(borrowIndex):", reserveData.borrowIndex.toString());
        console.log("   RAY:", (await pool.RAY()).toString());

        // 计算实际还款金额
        const scaledToBurn = (repayAmount * (await pool.RAY())) / reserveData.borrowIndex;
        console.log("   1 USDC对应的scaled值:", scaledToBurn.toString());

        if (scaledToBurn === 0n) {
            console.log("   ⚠️ 警告：1 USDC对应的scaled值为0！");
            console.log("   这意味着还款金额太小，无法减少借款余额");
            console.log("   解决方案：尝试还款更大金额（如10 USDC）");
        }
    }

    console.log("\n7. 前端可能的问题:");
    console.log("   a) 前端数据没有刷新 - 需要调用refetch函数");
    console.log("   b) 显示的是缓存数据 - 清除缓存或强制刷新");
    console.log("   c) 状态监听没有触发 - 检查useEffect依赖");
    console.log("   d) 金额太小被忽略 - 尝试更大金额");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});