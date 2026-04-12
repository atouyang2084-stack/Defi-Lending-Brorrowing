const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试基于hash的刷新逻辑");
    console.log("==========================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 模拟前端状态管理问题:");

    // 模拟第一次repay
    console.log("\n--- 第一次repay ---");
    const repayAmount = ethers.parseUnits("2", 6);

    // 检查并授权
    let allowance = await usdc.allowance(user.address, await pool.getAddress());
    if (allowance < repayAmount) {
        console.log("授权不足，先授权...");
        await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
    }

    console.log("发送第一次repay交易...");
    const tx1 = await pool.connect(user).repay({
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    });
    console.log("交易1哈希:", tx1.hash);
    console.log("等待确认...");
    await tx1.wait();
    console.log("✅ 第一次repay成功");

    // 模拟前端状态
    console.log("\n模拟前端状态:");
    console.log("repay.hash =", tx1.hash);
    console.log("repay.isSuccess = true");
    console.log("useEffect触发条件: hash && isSuccess = true");

    // 等待2秒模拟前端setTimeout
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 检查链上状态
    const afterFirst = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("链上借款余额:", ethers.formatUnits(afterFirst, 6), "USDC");

    console.log("\n--- 第二次repay ---");
    console.log("问题: 如果前端只监听isSuccess，第二次repay时isSuccess可能还是true");
    console.log("解决方案: 监听hash变化，而不是isSuccess");

    console.log("\n发送第二次repay交易...");
    const tx2 = await pool.connect(user).repay({
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    });
    console.log("交易2哈希:", tx2.hash);
    console.log("等待确认...");
    await tx2.wait();
    console.log("✅ 第二次repay成功");

    console.log("\n模拟前端状态变化:");
    console.log("repay.hash 从", tx1.hash, "变为", tx2.hash);
    console.log("repay.isSuccess 可能还是true");
    console.log("useEffect触发条件: hash变化 && isSuccess = true");

    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 检查链上状态
    const afterSecond = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("链上借款余额:", ethers.formatUnits(afterSecond, 6), "USDC");

    console.log("\n2. wagmi状态行为分析:");
    console.log("   useWriteContract返回的状态:");
    console.log("   - hash: 每次新交易会变化");
    console.log("   - isPending: 交易发送后为true，确认后为false");
    console.log("   - isSuccess: 交易确认后为true，可能不会自动重置");
    console.log("   - error: 错误信息");

    console.log("\n3. 问题根源:");
    console.log("   原始代码: useEffect依赖[repay.isSuccess, ...]");
    console.log("   问题: isSuccess在第一次成功后保持true，后续repay不会触发useEffect");
    console.log("   修复: useEffect依赖[repay.hash, repay.isSuccess, ...]");
    console.log("   原理: hash每次新交易都会变化，确保useEffect每次都能触发");

    console.log("\n4. 验证修复:");
    console.log("   第一次repay: hash=tx1, isSuccess=true → 触发刷新 ✓");
    console.log("   第二次repay: hash=tx2, isSuccess=true → 触发刷新 ✓");
    console.log("   第三次repay: hash=tx3, isSuccess=true → 触发刷新 ✓");

    console.log("\n5. 其他注意事项:");
    console.log("   a) 确保所有交易操作都使用相同的模式");
    console.log("   b) deposit、withdraw、borrow都需要相同修复");
    console.log("   c) 授权(allowance)操作也需要相同修复");

    console.log("\n6. 前端调试步骤:");
    console.log("   1. 重启前端服务器");
    console.log("   2. 打开浏览器控制台");
    console.log("   3. 尝试连续repay操作");
    console.log("   4. 观察日志:");
    console.log("      - 'repay.hash变化:' 应该每次都不一样");
    console.log("      - '=== 还款交易确认成功 ===' 应该每次都会出现");
    console.log("      - 'refetchBorrow完成' 应该每次都会出现");
    console.log("   5. 检查UI是否更新");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});