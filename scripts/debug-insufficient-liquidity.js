const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 调试InsufficientLiquidity错误");
    console.log("===============================\n");

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("你的地址:", yourAddress);
    console.log("USDC地址:", addresses.USDC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 检查当前状态
    console.log("\n1. 检查当前状态:");
    const balance = await usdc.balanceOf(yourAddress);
    const allowance = await usdc.allowance(yourAddress, addresses.LendingPool);
    const supply = await pool.userSupplyBalance(yourAddress, addresses.USDC);

    console.log(`余额: ${ethers.formatUnits(balance, 6)} USDC`);
    console.log(`授权: ${ethers.formatUnits(allowance, 6)} USDC`);
    console.log(`存款: ${ethers.formatUnits(supply, 6)} USDC`);

    // 模拟前端可能的问题
    console.log("\n2. 模拟前端可能的问题:");

    // 场景A: 前端认为授权足够，但实际上不够
    console.log("\n场景A: 前端授权检查逻辑问题");
    console.log("前端逻辑: if (allowance.data && allowance.data < amountBigInt)");
    console.log("可能问题:");
    console.log("1. allowance.data可能是undefined或null");
    console.log("2. 前端可能没有等待授权状态更新");
    console.log("3. 授权交易可能失败了但前端不知道");

    // 场景B: 授权交易被发送但失败了
    console.log("\n场景B: 授权交易失败");
    console.log("可能原因:");
    console.log("1. 用户拒绝了授权交易");
    console.log("2. 授权交易Gas不足");
    console.log("3. 网络问题");

    // 场景C: 前端没有请求授权
    console.log("\n场景C: 前端没有请求授权");
    console.log("可能原因:");
    console.log("1. 前端逻辑错误，直接跳过了授权检查");
    console.log("2. allowance.data检查条件有问题");

    // 测试具体案例
    console.log("\n3. 测试具体案例:");

    // 案例1: 完全没有授权
    console.log("\n案例1: 完全没有授权");
    const testUser1 = (await ethers.getSigners())[1];
    await usdc.mint(testUser1.address, ethers.parseUnits("10", 6));

    console.log(`测试用户 ${testUser1.address}`);
    console.log(`授权: ${ethers.formatUnits(await usdc.allowance(testUser1.address, addresses.LendingPool), 6)} USDC`);

    try {
        const tx = await pool.connect(testUser1).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser1.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("✅ 存款失败");
        console.log("错误:", error.message.includes("InsufficientLiquidity") ? "InsufficientLiquidity()" : error.message);
    }

    // 案例2: 授权不足
    console.log("\n案例2: 授权不足");
    const testUser2 = (await ethers.getSigners())[2];
    await usdc.mint(testUser2.address, ethers.parseUnits("10", 6));
    await usdc.connect(testUser2).approve(addresses.LendingPool, ethers.parseUnits("0.5", 6)); // 只授权0.5 USDC

    console.log(`测试用户 ${testUser2.address}`);
    console.log(`授权: ${ethers.formatUnits(await usdc.allowance(testUser2.address, addresses.LendingPool), 6)} USDC`);

    try {
        const tx = await pool.connect(testUser2).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6), // 尝试存1 USDC
            onBehalfOf: testUser2.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（授权不足）");
    } catch (error) {
        console.log("✅ 存款失败");
        console.log("错误:", error.message.includes("InsufficientLiquidity") ? "InsufficientLiquidity()" : error.message);
    }

    // 案例3: 正确授权
    console.log("\n案例3: 正确授权");
    const testUser3 = (await ethers.getSigners())[3];
    await usdc.mint(testUser3.address, ethers.parseUnits("10", 6));
    await usdc.connect(testUser3).approve(addresses.LendingPool, ethers.parseUnits("5", 6));

    console.log(`测试用户 ${testUser3.address}`);
    console.log(`授权: ${ethers.formatUnits(await usdc.allowance(testUser3.address, addresses.LendingPool), 6)} USDC`);

    try {
        const tx = await pool.connect(testUser3).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser3.address
        });
        await tx.wait();
        console.log("✅ 存款成功");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
    }

    // 检查前端可能的具体问题
    console.log("\n4. 前端具体问题检查:");

    // 问题1: 前端可能发送了授权交易，但用户拒绝了
    console.log("\n问题1: 用户拒绝了授权交易");
    console.log("表现: MetaMask弹出授权窗口，用户点击拒绝");
    console.log("结果: 授权交易失败，但前端可能不知道");
    console.log("解决方案: 前端需要处理授权交易失败的情况");

    // 问题2: 前端没有等待授权确认
    console.log("\n问题2: 前端没有等待授权确认");
    console.log("表现: 前端发送授权交易后立即尝试存款");
    console.log("结果: 授权还没生效，存款失败");
    console.log("解决方案: 等待授权交易确认后再存款");

    // 问题3: 前端授权检查逻辑错误
    console.log("\n问题3: 前端授权检查逻辑错误");
    console.log("当前前端代码:");
    console.log("if (allowance.data && allowance.data < amountBigInt) {");
    console.log("    allowance.approve(amountBigInt);");
    console.log("} else {");
    console.log("    deposit.deposit(...);");
    console.log("}");
    console.log("\n可能问题:");
    console.log("1. allowance.data可能是undefined（首次加载）");
    console.log("2. 应该检查allowance.data === undefined的情况");
    console.log("3. 应该显示加载状态");

    // 建议的修复
    console.log("\n5. 建议的前端修复:");
    console.log("修复方案1: 改进授权检查逻辑");
    console.log("if (allowance.isLoading) {");
    console.log("    // 显示加载中");
    console.log("} else if (!allowance.data || allowance.data < amountBigInt) {");
    console.log("    // 需要授权");
    console.log("    allowance.approve(amountBigInt);");
    console.log("} else {");
    console.log("    // 已有足够授权，可以存款");
    console.log("    deposit.deposit(...);");
    console.log("}");

    console.log("\n修复方案2: 添加错误处理");
    console.log("if (allowance.error) {");
    console.log("    // 显示授权错误");
    console.log("    console.error('授权错误:', allowance.error);");
    console.log("}");

    console.log("\n修复方案3: 等待授权确认");
    console.log("const handleApprove = async () => {");
    console.log("    await allowance.approve(amountBigInt);");
    console.log("    // 等待授权确认");
    console.log("    await waitForTransaction({ hash: allowance.hash });");
    console.log("    // 刷新授权数据");
    console.log("    allowance.refetch();");
    console.log("};");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});