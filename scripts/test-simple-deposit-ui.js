const { ethers } = require("hardhat");
const fs = require("fs");

// 这个脚本模拟一个简单的UI测试，帮助我们找到问题
async function main() {
    console.log("🎯 简单存款UI测试");
    console.log("================\n");

    const [deployer, user] = await ethers.getSigners();

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("用户地址:", user.address);
    console.log("USDC地址:", addresses.USDC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 给用户USDC
    await usdc.connect(deployer).mint(user.address, ethers.parseUnits("100", 6));

    // 测试场景1: 直接调用（应该成功）
    console.log("\n🔧 测试场景1: 直接合约调用");
    await testDirectCall(user, usdc, pool, addresses);

    // 测试场景2: 模拟前端流程
    console.log("\n🔧 测试场景2: 模拟前端完整流程");
    await testFrontendFlow(user, usdc, pool, addresses);

    // 测试场景3: 检查常见错误
    console.log("\n🔧 测试场景3: 检查常见错误原因");
    await testErrorScenarios(user, usdc, pool, addresses);
}

async function testDirectCall(user, usdc, pool, addresses) {
    console.log("1. 授权10 USDC");
    await usdc.connect(user).approve(addresses.LendingPool, ethers.parseUnits("10", 6));

    console.log("2. 存款5 USDC");
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("5", 6),
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("✅ 直接调用成功");
    } catch (error) {
        console.log("❌ 直接调用失败:", error.message);
        analyzeError(error, usdc, pool, addresses, user.address);
    }
}

async function testFrontendFlow(user, usdc, pool, addresses) {
    console.log("1. 检查余额");
    const balance = await usdc.balanceOf(user.address);
    console.log(`   余额: ${ethers.formatUnits(balance, 6)} USDC`);

    console.log("2. 检查授权");
    const allowance = await usdc.allowance(user.address, addresses.LendingPool);
    console.log(`   授权: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 模拟前端：用户输入1 USDC
    const frontendAmount = "1";
    console.log(`3. 前端输入: ${frontendAmount} USDC`);

    // 前端计算
    const amountFloat = parseFloat(frontendAmount);
    const amountBigInt = BigInt(Math.floor(amountFloat * 10 ** 6));
    console.log(`   计算后: ${amountBigInt} wei`);

    console.log("4. 检查是否需要授权");
    if (allowance < amountBigInt) {
        console.log(`   需要授权 ${ethers.formatUnits(amountBigInt, 6)} USDC`);
        await usdc.connect(user).approve(addresses.LendingPool, amountBigInt);
        console.log("   ✅ 授权完成");
    } else {
        console.log("   已有足够授权");
    }

    console.log("5. 执行存款");
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: amountBigInt,
            onBehalfOf: user.address
        });
        const receipt = await tx.wait();
        console.log("   ✅ 存款成功");
        console.log(`   交易哈希: ${receipt.hash}`);
        console.log(`   Gas used: ${receipt.gasUsed}`);
    } catch (error) {
        console.log("   ❌ 存款失败:", error.message);
        analyzeError(error, usdc, pool, addresses, user.address);
    }
}

async function testErrorScenarios(user, usdc, pool, addresses) {
    console.log("测试各种错误场景:");

    // 场景1: 没有授权
    console.log("\n场景1: 没有授权");
    const testUser = (await ethers.getSigners())[2]; // 新用户
    await usdc.connect(user).mint(testUser.address, ethers.parseUnits("10", 6));

    try {
        const tx = await pool.connect(testUser).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser.address
        });
        await tx.wait();
        console.log("   ❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("   ✅ 正确失败:", error.message.includes("ERC20") ? "授权不足" : error.message);
    }

    // 场景2: 金额为0
    console.log("\n场景2: 金额为0");
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: 0n,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("   ❌ 不应该成功（金额为0）");
    } catch (error) {
        console.log("   ✅ 正确失败:", error.message.includes("InvalidAmount") ? "InvalidAmount" : error.message);
    }

    // 场景3: 无效资产地址
    console.log("\n场景3: 无效资产地址");
    try {
        const tx = await pool.connect(user).deposit({
            asset: "0x0000000000000000000000000000000000000000",
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("   ❌ 不应该成功（无效资产）");
    } catch (error) {
        console.log("   ✅ 正确失败:", error.message);
    }

    // 场景4: 算术溢出（尝试极小金额）
    console.log("\n场景4: 极小金额（可能算术溢出）");
    const tinyAmount = 1n; // 1 wei = 0.000001 USDC
    await usdc.connect(user).approve(addresses.LendingPool, tinyAmount);

    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: tinyAmount,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("   ✅ 存款成功（最小金额）");
    } catch (error) {
        console.log("   ❌ 存款失败:", error.message);
        if (error.message.includes("panic code 0x11")) {
            console.log("     这是算术溢出错误！");
        }
    }
}

function analyzeError(error, usdc, pool, addresses, userAddress) {
    console.log("\n错误分析:");

    if (error.message.includes("panic code 0x11")) {
        console.log("1. 算术溢出错误 (panic code 0x11)");
        console.log("   可能原因:");
        console.log("   - 存款金额太小，导致scaled=0");
        console.log("   - 算术运算溢出");
    }

    if (error.message.includes("InvalidAmount")) {
        console.log("2. InvalidAmount错误");
        console.log("   可能原因: amount=0 或 scaled=0");
    }

    if (error.message.includes("ERC20")) {
        console.log("3. ERC20错误");
        console.log("   可能原因: 授权不足或余额不足");
    }

    if (error.message.includes("AssetNotActive")) {
        console.log("4. AssetNotActive错误");
        console.log("   可能原因: 资产未激活");
    }

    // 检查具体数值
    console.log("\n检查数值:");
    try {
        const reserveData = pool.getReserveData(addresses.USDC);
        console.log("   Reserve数据获取成功");
    } catch (e) {
        console.log("   无法获取reserve数据:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});