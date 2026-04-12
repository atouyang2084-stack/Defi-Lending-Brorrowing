const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试最大值授权的好处");
    console.log("=======================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 问题分析:");
    console.log("   用户抱怨: '为什么每次repay还要额度'");
    console.log("   原因: 每次只授权刚好够的金额，用完就需要重新授权");

    console.log("\n2. 解决方案: 最大值授权");
    console.log("   授权 2^256 - 1 (约1.15e77) USDC");
    console.log("   一次授权，永久使用（理论上）");

    console.log("\n3. 对比两种授权方式:");

    console.log("\n   💰 方式A: 特定金额授权");
    console.log("   - 用户repay 1 USDC → 授权1 USDC");
    console.log("   - 用户再repay 1 USDC → 需要重新授权 ✗");
    console.log("   - 用户repay 2 USDC → 需要重新授权 ✗");
    console.log("   - 每次都需要授权，很麻烦");

    console.log("\n   🚀 方式B: 最大值授权");
    console.log("   - 用户第一次操作 → 授权最大值");
    console.log("   - 用户repay 1 USDC → 直接repay ✓");
    console.log("   - 用户repay 10 USDC → 直接repay ✓");
    console.log("   - 用户repay 100 USDC → 直接repay ✓");
    console.log("   - 用户deposit 1000 USDC → 直接deposit ✓");
    console.log("   - 一次授权，多次使用");

    console.log("\n4. 实际测试最大值授权:");

    // 清除现有授权
    console.log("\n   清除现有授权...");
    await usdc.connect(user).approve(await pool.getAddress(), 0n);

    const MAX_UINT256 = 2n ** 256n - 1n;
    console.log("   最大值: 2^256 - 1 =", MAX_UINT256.toString());
    console.log("   这个数字非常大，实际使用中永远不会用完");

    console.log("\n   发送最大值授权交易...");
    const approveTx = await usdc.connect(user).approve(await pool.getAddress(), MAX_UINT256);
    await approveTx.wait();
    console.log("   ✅ 最大值授权成功");

    const allowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   授权后额度:", allowance.toString());
    console.log("   是否等于最大值?", allowance === MAX_UINT256);

    console.log("\n5. 测试多次操作无需重新授权:");

    const testAmounts = [
        ethers.parseUnits("1", 6),    // 1 USDC
        ethers.parseUnits("5", 6),    // 5 USDC
        ethers.parseUnits("10", 6),   // 10 USDC
        ethers.parseUnits("50", 6),   // 50 USDC
    ];

    let currentBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("   初始借款余额:", ethers.formatUnits(currentBorrowBalance, 6), "USDC");

    for (let i = 0; i < testAmounts.length; i++) {
        const amount = testAmounts[i];
        console.log(`\n   --- 第${i + 1}次repay: ${ethers.formatUnits(amount, 6)} USDC ---`);

        // 检查授权是否足够（应该足够）
        const currentAllowance = await usdc.allowance(user.address, await pool.getAddress());
        console.log("   当前授权:", currentAllowance.toString());
        console.log("   需要授权:", amount.toString());
        console.log("   授权是否足够?", currentAllowance >= amount);

        if (currentAllowance >= amount) {
            console.log("   ✅ 授权足够，无需重新授权");
        } else {
            console.log("   ❌ 需要重新授权");
        }

        // 执行repay
        console.log("   执行repay...");
        const repayTx = await pool.connect(user).repay({
            asset: await usdc.getAddress(),
            amount: amount,
            onBehalfOf: user.address
        });
        await repayTx.wait();
        console.log("   ✅ repay成功");

        const newBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
        console.log("   还款后借款余额:", ethers.formatUnits(newBorrowBalance, 6), "USDC");
    }

    console.log("\n6. 前端改进:");
    console.log("   ✅ 默认推荐最大值授权");
    console.log("   ✅ 清晰的提示信息");
    console.log("   ✅ 用户可以选择授权方式");
    console.log("   ✅ 一次授权，多次使用");

    console.log("\n7. 用户收益:");
    console.log("   - 减少MetaMask交互次数");
    console.log("   - 节省gas费用（一次授权 vs 多次授权）");
    console.log("   - 更好的用户体验");
    console.log("   - 避免'授权额度不足'错误");

    console.log("\n8. 安全考虑:");
    console.log("   - 授权给可信合约（自己的LendingPool）");
    console.log("   - 最大值授权不会实际转移资金");
    console.log("   - 合约只能使用用户同意的金额");
    console.log("   - 用户可以随时取消授权（授权0）");

    console.log("\n9. 总结:");
    console.log("   最大值授权是DeFi中的标准做法");
    console.log("   一次授权，永久使用（直到用户取消）");
    console.log("   大大改善用户体验");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});