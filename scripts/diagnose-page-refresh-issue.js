const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 诊断页面刷新问题");
    console.log("====================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 模拟用户描述的问题:");
    console.log("   '每次打开http://localhost:5173/的时候，第一次repay就能成'");
    console.log("   '但是第二次点击还是会确认，但是没有任何反馈'");
    console.log("   '我关闭http://localhost:5173/重新打开之后，就又可以进行一次repay了'");

    console.log("\n2. 问题分析:");
    console.log("   a) 页面刷新 → 前端状态重置 → 可以repay ✓");
    console.log("   b) 第一次repay → 成功 ✓");
    console.log("   c) 第二次repay（不刷新页面）→ 无反馈 ✗");
    console.log("   d) 重新打开页面 → 状态重置 → 可以repay ✓");

    console.log("\n3. 根本原因:");
    console.log("   wagmi的useWriteContract状态不会自动重置");
    console.log("   - isSuccess: 交易成功后保持true");
    console.log("   - hash: 交易哈希，但可能被重用？");
    console.log("   - 页面刷新会重置所有React状态");
    console.log("   - 不刷新页面则状态保持");

    console.log("\n4. 已实施的修复:");
    console.log("   a) 监听hash变化而不是isSuccess");
    console.log("   b) 添加reset函数到所有hook");
    console.log("   c) 增强调试日志");

    console.log("\n5. 验证当前状态:");

    // 模拟第一次repay
    console.log("\n--- 模拟第一次repay ---");
    const repayAmount = ethers.parseUnits("1", 6);

    // 检查授权
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
    const hash1 = tx1.hash;
    console.log("交易1哈希:", hash1);
    await tx1.wait();
    console.log("✅ 第一次repay成功");

    const afterFirst = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("链上借款余额:", ethers.formatUnits(afterFirst, 6), "USDC");

    console.log("\n--- 模拟第二次repay（不刷新页面） ---");
    console.log("问题: 前端isSuccess可能还是true，hash可能没变化？");

    console.log("发送第二次repay交易...");
    const tx2 = await pool.connect(user).repay({
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    });
    const hash2 = tx2.hash;
    console.log("交易2哈希:", hash2);
    console.log("hash1 === hash2?", hash1 === hash2);
    console.log("hash应该不同，所以useEffect应该触发");

    await tx2.wait();
    console.log("✅ 第二次repay成功");

    const afterSecond = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("链上借款余额:", ethers.formatUnits(afterSecond, 6), "USDC");

    console.log("\n6. 如果问题仍然存在，可能的原因:");
    console.log("   a) 前端代码没有重新编译/重启");
    console.log("   b) 浏览器缓存了旧代码");
    console.log("   c) useEffect依赖数组有问题");
    console.log("   d) hash确实没有变化（不可能）");

    console.log("\n7. 解决方案验证:");
    console.log("   方案1: 监听hash变化（已实施）");
    console.log("   方案2: 手动调用reset()函数（已添加）");
    console.log("   方案3: 使用useEffect清理函数");

    console.log("\n8. 紧急解决方案:");
    console.log("   在Reserve.tsx中添加手动reset:");
    console.log("   ```typescript");
    console.log("   // 在交易成功后调用reset");
    console.log("   useEffect(() => {");
    console.log("       if (repay.hash && repay.isSuccess) {");
    console.log("           // ...刷新数据...");
    console.log("           setTimeout(() => {");
    console.log("               repay.reset(); // 重置状态");
    console.log("           }, 3000);");
    console.log("       }");
    console.log("   }, [repay.hash, repay.isSuccess]);");
    console.log("   ```");

    console.log("\n9. 测试步骤:");
    console.log("   1. 确保前端服务器重启");
    console.log("   2. 清除浏览器缓存（Ctrl+Shift+R强制刷新）");
    console.log("   3. 打开控制台查看日志");
    console.log("   4. 尝试连续repay");
    console.log("   5. 观察hash是否变化，useEffect是否触发");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});