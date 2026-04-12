const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 调试前端存款问题");
    console.log("===================\n");

    const [deployer, user] = await ethers.getSigners();

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    // 给用户一些USDC
    const usdcAmount = ethers.parseUnits("1000", 6);
    await usdc.connect(deployer).mint(user.address, usdcAmount);

    console.log("用户地址:", user.address);
    console.log("用户USDC余额:", ethers.formatUnits(await usdc.balanceOf(user.address), 6), "USDC");

    // 模拟前端可能的问题
    console.log("\n测试前端可能的问题:");

    // 问题1: 金额为0
    console.log("\n1. 测试金额为0:");
    try {
        await usdc.connect(user).approve(pool.target, 0n);
        const tx = await pool.connect(user).deposit({
            asset: usdc.target,
            amount: 0n,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("❌ 不应该成功 - 金额为0应该revert");
    } catch (error) {
        console.log("✅ 正确revert:", error.message.includes("InvalidAmount") ? "InvalidAmount" : error.message);
    }

    // 问题2: 金额非常大（可能导致溢出）
    console.log("\n2. 测试极大金额:");
    const hugeAmount = ethers.parseUnits("1000000000000", 6); // 1万亿 USDC
    await usdc.connect(deployer).mint(user.address, hugeAmount);
    await usdc.connect(user).approve(pool.target, hugeAmount);

    try {
        const tx = await pool.connect(user).deposit({
            asset: usdc.target,
            amount: hugeAmount,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("✅ 存款成功（如果合约有足够容量）");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
        if (error.message.includes("panic code 0x11")) {
            console.log("  这是算术溢出错误");
        }
    }

    // 问题3: 检查前端计算方式
    console.log("\n3. 模拟前端金额计算:");
    const frontendInputs = ["0.0000001", "0.000001", "0.5", "1", "10", "100", "0"];

    for (const input of frontendInputs) {
        const amountFloat = parseFloat(input);
        const amountBigInt = BigInt(Math.floor(amountFloat * 10 ** 6)); // USDC有6位小数

        console.log(`\n输入: "${input}" USDC`);
        console.log(`  解析后: ${amountFloat}`);
        console.log(`  BigInt: ${amountBigInt}`);
        console.log(`  实际USDC: ${ethers.formatUnits(amountBigInt, 6)}`);

        if (amountBigInt === 0n) {
            console.log(`  ⚠️ 前端计算后金额为0！`);
            console.log(`  这会导致合约revert with "InvalidAmount"`);
        }

        // 计算scaled值
        const reserveData = await pool.getReserveData(usdc.target);
        const RAY = 1000000000000000000000000000n;
        const scaled = amountBigInt > 0n ? (amountBigInt * RAY) / reserveData.supplyIndex : 0n;

        console.log(`  scaled值: ${scaled}`);
        if (amountBigInt > 0n && scaled === 0n) {
            console.log(`  ⚠️ scaled = 0，这会导致算术溢出错误！`);
            console.log(`  原因: amount(${amountBigInt}) * RAY(${RAY}) / supplyIndex(${reserveData.supplyIndex}) = 0`);
        }
    }

    // 问题4: 检查授权问题
    console.log("\n4. 测试授权不足:");
    const testAmount = ethers.parseUnits("50", 6);

    // 只授权10 USDC，但尝试存款50 USDC
    await usdc.connect(user).approve(pool.target, ethers.parseUnits("10", 6));

    try {
        const tx = await pool.connect(user).deposit({
            asset: usdc.target,
            amount: testAmount,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("❌ 不应该成功 - 授权不足");
    } catch (error) {
        console.log("✅ 正确失败（授权不足）");
    }

    // 问题5: 检查实际的存款函数
    console.log("\n5. 实际存款测试（10 USDC）:");
    const depositAmount = ethers.parseUnits("10", 6);
    await usdc.connect(user).approve(pool.target, depositAmount);

    try {
        const tx = await pool.connect(user).deposit({
            asset: usdc.target,
            amount: depositAmount,
            onBehalfOf: user.address
        });
        const receipt = await tx.wait();
        console.log("✅ 存款成功！");
        console.log(`  Gas used: ${receipt.gasUsed}`);
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 详细分析错误
        if (error.message.includes("panic code 0x11")) {
            console.log("\n详细分析算术溢出:");
            const reserveData = await pool.getReserveData(usdc.target);
            const RAY = 1000000000000000000000000000n;

            console.log(`  depositAmount: ${depositAmount}`);
            console.log(`  RAY: ${RAY}`);
            console.log(`  supplyIndex: ${reserveData.supplyIndex}`);

            const scaled = (depositAmount * RAY) / reserveData.supplyIndex;
            console.log(`  scaled = ${scaled}`);

            // 检查合约中的计算
            console.log(`\n合约计算检查:`);
            console.log(`  (${depositAmount} * ${RAY}) = ${depositAmount * RAY}`);
            console.log(`  / ${reserveData.supplyIndex} = ${scaled}`);

            if (scaled === 0n) {
                console.log(`  ⚠️ scaled = 0，这会导致算术溢出错误！`);
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});