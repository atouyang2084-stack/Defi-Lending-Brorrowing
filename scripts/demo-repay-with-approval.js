const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 演示完整还款流程（包含授权）");
    console.log("================================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 检查初始状态:");
    const initialBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const initialUsdcBalance = await usdc.balanceOf(user.address);
    const initialAllowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(initialBorrowBalance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(initialUsdcBalance, 6), "USDC");
    console.log("   初始授权:", ethers.formatUnits(initialAllowance, 6), "USDC");

    // 如果没有借款，创建测试场景
    if (initialBorrowBalance === 0n) {
        console.log("\n2. 创建测试借款场景...");

        // 部署者存款提供流动性
        const depositAmount = ethers.parseUnits("1000", 6);
        await usdc.connect(deployer).approve(await pool.getAddress(), depositAmount);
        await pool.connect(deployer).deposit({
            asset: await usdc.getAddress(),
            amount: depositAmount,
            onBehalfOf: deployer.address
        });
        console.log("   ✅ 部署者存款成功");

        // 用户抵押WBTC
        const wbtc = MockERC20.attach(addresses.WBTC);
        const wbtcAmount = ethers.parseUnits("0.1", 8);
        await wbtc.connect(user).approve(await pool.getAddress(), wbtcAmount);
        await pool.connect(user).deposit({
            asset: await wbtc.getAddress(),
            amount: wbtcAmount,
            onBehalfOf: user.address
        });
        console.log("   ✅ 用户抵押WBTC成功");

        // 用户借款
        const borrowAmount = ethers.parseUnits("10", 6);
        await pool.connect(user).borrow({
            asset: await usdc.getAddress(),
            amount: borrowAmount,
            onBehalfOf: user.address
        });
        console.log("   ✅ 用户借款成功");
    }

    console.log("\n3. 模拟前端用户操作:");
    const repayAmount = ethers.parseUnits("1", 6);

    // 检查当前状态
    const currentBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const currentUsdcBalance = await usdc.balanceOf(user.address);
    const currentAllowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(currentBorrowBalance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(currentUsdcBalance, 6), "USDC");
    console.log("   当前授权:", ethers.formatUnits(currentAllowance, 6), "USDC");
    console.log("   还款金额:", ethers.formatUnits(repayAmount, 6), "USDC");

    // 模拟前端检查
    console.log("\n4. 前端检查逻辑:");

    // 检查1: 是否有借款余额
    if (currentBorrowBalance === 0n) {
        console.log("   ❌ 错误: 没有借款余额，无需还款");
        return;
    }
    console.log("   ✅ 检查1: 有借款余额");

    // 检查2: 还款金额是否超过借款余额
    if (repayAmount > currentBorrowBalance) {
        console.log(`   ❌ 错误: 还款金额超过借款余额 (最大: ${ethers.formatUnits(currentBorrowBalance, 6)} USDC)`);
        return;
    }
    console.log("   ✅ 检查2: 还款金额不超过借款余额");

    // 检查3: 余额是否足够
    if (currentUsdcBalance < repayAmount) {
        console.log(`   ❌ 错误: 余额不足 (需要: ${ethers.formatUnits(repayAmount, 6)} USDC, 拥有: ${ethers.formatUnits(currentUsdcBalance, 6)} USDC)`);
        return;
    }
    console.log("   ✅ 检查3: 余额足够");

    // 检查4: 授权是否足够
    if (currentAllowance < repayAmount) {
        console.log(`   ⚠️ 检查4: 授权不足 (需要: ${ethers.formatUnits(repayAmount, 6)} USDC, 已授权: ${ethers.formatUnits(currentAllowance, 6)} USDC)`);
        console.log("   前端应该显示'Approve'按钮而不是'Repay'按钮");

        // 模拟用户点击Approve
        console.log("\n5. 用户点击'Approve'按钮:");
        console.log("   发送授权交易...");
        const approveTx = await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
        console.log("   ✅ 授权交易已发送:", approveTx.hash);

        const approveReceipt = await approveTx.wait();
        console.log("   ✅ 授权成功，区块:", approveReceipt.blockNumber);

        // 更新授权状态
        const newAllowance = await usdc.allowance(user.address, await pool.getAddress());
        console.log("   新授权额度:", ethers.formatUnits(newAllowance, 6), "USDC");

        console.log("\n   提示: 授权成功后，前端按钮应该从'Approve'变为'Repay'");
        console.log("   用户需要再次点击'Repay'按钮执行还款");

        // 等待用户再次点击Repay
        console.log("\n6. 用户点击'Repay'按钮:");
    } else {
        console.log("   ✅ 检查4: 授权足够");
        console.log("\n5. 用户点击'Repay'按钮:");
    }

    // 执行还款
    console.log("   执行还款...");
    const repayParams = {
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    };

    try {
        const repayTx = await pool.connect(user).repay(repayParams);
        console.log("   ✅ 还款交易已发送:", repayTx.hash);

        const repayReceipt = await repayTx.wait();
        console.log("   ✅ 还款成功，区块:", repayReceipt.blockNumber);

        // 检查结果
        const afterBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
        const afterUsdcBalance = await usdc.balanceOf(user.address);

        console.log("\n7. 还款结果:");
        console.log("   还款前借款余额:", ethers.formatUnits(currentBorrowBalance, 6), "USDC");
        console.log("   还款后借款余额:", ethers.formatUnits(afterBorrowBalance, 6), "USDC");
        console.log("   减少的借款:", ethers.formatUnits(currentBorrowBalance - afterBorrowBalance, 6), "USDC");
        console.log("   还款前USDC余额:", ethers.formatUnits(currentUsdcBalance, 6), "USDC");
        console.log("   还款后USDC余额:", ethers.formatUnits(afterUsdcBalance, 6), "USDC");
        console.log("   消耗的USDC:", ethers.formatUnits(currentUsdcBalance - afterUsdcBalance, 6), "USDC");

    } catch (error) {
        console.log("   ❌ 还款失败:", error.message);
        if (error.reason) {
            console.log("   错误原因:", error.reason);
        }
    }

    console.log("\n8. 总结:");
    console.log("   前端repay问题的根本原因: 授权不足");
    console.log("   解决方案:");
    console.log("   1. 前端检查授权是否足够");
    console.log("   2. 如果授权不足，显示'Approve'按钮");
    console.log("   3. 用户点击'Approve'进行授权");
    console.log("   4. 授权成功后，按钮变为'Repay'");
    console.log("   5. 用户点击'Repay'执行还款");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});