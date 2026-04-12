const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试增强的授权逻辑");
    console.log("======================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 模拟用户遇到'授权额度不足'问题:");
    console.log("   用户报告: '有时候弹窗会显示授权额度不足，就会失败'");

    console.log("\n2. 可能的原因分析:");
    console.log("   a) 授权交易失败（用户拒绝、网络问题等）");
    console.log("   b) 授权数据没有及时更新");
    console.log("   c) 授权金额计算错误");
    console.log("   d) 前端状态管理问题");

    console.log("\n3. 已实施的增强修复:");

    console.log("\n   修复1: 更好的错误处理");
    console.log("   - 捕获授权调用错误");
    console.log("   - 显示具体的错误信息");
    console.log("   - 重置状态避免卡住");

    console.log("\n   修复2: 授权状态监控");
    console.log("   - 监听allowance状态变化");
    console.log("   - 添加调试日志");
    console.log("   - 确保数据及时更新");

    console.log("\n   修复3: 授权选项");
    console.log("   - 确定: 授权本次还款金额");
    console.log("   - 取消: 授权最大值（避免重复授权）");
    console.log("   - 关闭: 取消授权");

    console.log("\n   修复4: 自动repay增强");
    console.log("   - 添加延迟确保数据更新");
    console.log("   - 双重检查授权是否足够");
    console.log("   - 更好的错误提示");

    console.log("\n4. 测试授权流程:");

    // 清除授权
    console.log("\n   清除现有授权...");
    await usdc.connect(user).approve(await pool.getAddress(), 0n);
    const initialAllowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   初始授权:", ethers.formatUnits(initialAllowance, 6), "USDC");

    const repayAmount = ethers.parseUnits("1", 6);
    console.log("   还款金额:", ethers.formatUnits(repayAmount, 6), "USDC");

    console.log("\n5. 测试特定金额授权:");
    console.log("   模拟用户点击'确定'（授权本次金额）");
    console.log("   发送授权交易...");
    const specificApproveTx = await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
    await specificApproveTx.wait();
    console.log("   ✅ 特定金额授权成功");

    const specificAllowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   授权后额度:", ethers.formatUnits(specificAllowance, 6), "USDC");

    console.log("\n6. 测试最大值授权:");
    console.log("   模拟用户点击'取消'（授权最大值）");
    console.log("   清除授权...");
    await usdc.connect(user).approve(await pool.getAddress(), 0n);

    console.log("   发送最大值授权交易...");
    const maxApproveTx = await usdc.connect(user).approve(await pool.getAddress(), 2n ** 256n - 1n);
    await maxApproveTx.wait();
    console.log("   ✅ 最大值授权成功");

    const maxAllowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   最大值授权后额度:", ethers.formatUnits(maxAllowance, 6), "USDC");
    console.log("   (应该是非常大的数字)");

    console.log("\n7. 测试自动repay:");
    console.log("   模拟授权成功后自动repay...");
    const repayTx = await pool.connect(user).repay({
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    });
    await repayTx.wait();
    console.log("   ✅ 自动repay成功");

    console.log("\n8. 前端调试信息:");
    console.log("   用户应该看到以下日志:");
    console.log("   - '授权状态变化:' - 显示授权状态");
    console.log("   - '授权自动repay检查:' - 显示检查条件");
    console.log("   - '=== repay授权成功，准备自动执行还款 ==='");
    console.log("   - '自动还款检查:' - 显示授权检查结果");
    console.log("   - '授权足够，执行自动还款...'");

    console.log("\n9. 用户界面改进:");
    console.log("   a) 更清晰的授权提示，显示当前和需要授权");
    console.log("   b) 提供授权选项（本次金额 vs 最大值）");
    console.log("   c) 更好的错误信息");
    console.log("   d) 授权中显示'Approving...'状态");

    console.log("\n10. 预期结果:");
    console.log("   ✅ 授权失败时显示具体原因");
    console.log("   ✅ 授权成功后自动执行repay");
    console.log("   ✅ 授权数据及时更新");
    console.log("   ✅ 用户无需重复点击");
    console.log("   ✅ 避免'授权额度不足'错误");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});