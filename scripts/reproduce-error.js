const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 尝试重现算术溢出错误");
    console.log("=========================\n");

    const [deployer, user] = await ethers.getSigners();

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    // 给用户一些USDC
    await usdc.connect(deployer).mint(user.address, ethers.parseUnits("1000", 6));

    console.log("测试各种可能触发算术溢出的情况:");

    // 情况1: 使userSupplyScaled接近最大值
    console.log("\n1. 测试userSupplyScaled接近最大值:");

    // 获取当前userSupplyScaled
    const currentScaled = await pool.userSupplyScaled(user.address, usdc.target);
    console.log(`当前userSupplyScaled: ${currentScaled}`);

    // 计算最大可能值
    const maxUint256 = ethers.MaxUint256;
    console.log(`type(uint256).max: ${maxUint256}`);

    // 尝试存款一个会使总和溢出的金额
    const overflowAmount = maxUint256 - currentScaled + 1n;

    // 我们需要将overflowAmount转换回USDC金额
    const reserveData = await pool.getReserveData(usdc.target);
    const RAY = 1000000000000000000000000000n;

    // scaled = (amount * RAY) / supplyIndex
    // 所以 amount = (scaled * supplyIndex) / RAY
    const overflowUsdc = (overflowAmount * reserveData.supplyIndex + RAY - 1n) / RAY;

    console.log(`需要溢出的scaled值: ${overflowAmount}`);
    console.log(`对应的USDC金额: ${ethers.formatUnits(overflowUsdc, 6)} USDC`);

    // 给用户这么多USDC
    await usdc.connect(deployer).mint(user.address, overflowUsdc * 2n);
    await usdc.connect(user).approve(pool.target, overflowUsdc);

    try {
        console.log(`尝试存款 ${ethers.formatUnits(overflowUsdc, 6)} USDC...`);
        const tx = await pool.connect(user).deposit({
            asset: usdc.target,
            amount: overflowUsdc,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("❌ 不应该成功 - 应该溢出");
    } catch (error) {
        console.log("错误:", error.message);
        if (error.message.includes("panic code 0x11")) {
            console.log("✅ 成功触发算术溢出错误!");
        } else if (error.message.includes("InsufficientLiquidity")) {
            console.log("✅ 触发溢出检查（合约的防护机制）");
        }
    }

    // 情况2: 测试非常特殊的边界情况
    console.log("\n2. 测试边界情况:");

    // 重置状态
    // 先提取所有存款（如果有）
    const userSupply = await pool.userSupplyBalance(user.address, usdc.target);
    if (userSupply > 0n) {
        await pool.connect(user).withdraw({
            asset: usdc.target,
            amount: userSupply,
            to: user.address
        });
    }

    // 测试一个刚好使 scaled = 0 的金额
    // scaled = (amount * RAY) / supplyIndex = 0
    // 这意味着 amount * RAY < supplyIndex
    // 所以 amount < supplyIndex / RAY

    const supplyIndex = reserveData.supplyIndex;
    const minAmount = supplyIndex / RAY; // 这是使 scaled >= 1 的最小金额

    // 测试一个刚好小于 minAmount 的金额
    const tinyAmount = minAmount > 1n ? minAmount - 1n : 0n;

    if (tinyAmount > 0n) {
        console.log(`\n测试刚好小于最小值的金额:`);
        console.log(`supplyIndex: ${supplyIndex}`);
        console.log(`RAY: ${RAY}`);
        console.log(`minAmount (使scaled>=1): ${minAmount} wei = ${ethers.formatUnits(minAmount, 6)} USDC`);
        console.log(`tinyAmount (测试): ${tinyAmount} wei = ${ethers.formatUnits(tinyAmount, 6)} USDC`);

        // 给用户这个金额
        await usdc.connect(deployer).mint(user.address, tinyAmount);
        await usdc.connect(user).approve(pool.target, tinyAmount);

        try {
            const tx = await pool.connect(user).deposit({
                asset: usdc.target,
                amount: tinyAmount,
                onBehalfOf: user.address
            });
            await tx.wait();
            console.log("❌ 不应该成功 - scaled应该为0");
        } catch (error) {
            console.log("错误:", error.message);
            if (error.message.includes("InvalidAmount")) {
                console.log("✅ 触发InvalidAmount（scaled == 0）");
            }
        }
    }

    // 情况3: 测试前端实际可能输入的值
    console.log("\n3. 测试前端常见输入:");

    const testCases = [
        { input: "0.0000009", desc: "小于最小单位" },
        { input: "0.000001", desc: "正好最小单位" },
        { input: "0.1", desc: "0.1 USDC" },
        { input: "1", desc: "1 USDC" },
        { input: "100", desc: "100 USDC" },
    ];

    for (const tc of testCases) {
        console.log(`\n测试: ${tc.desc} (${tc.input} USDC)`);

        const amountFloat = parseFloat(tc.input);
        const amountBigInt = BigInt(Math.floor(amountFloat * 10 ** 6));

        if (amountBigInt === 0n) {
            console.log(`  前端计算后: 0 wei`);
            console.log(`  会导致: InvalidAmount错误`);
            continue;
        }

        console.log(`  前端计算后: ${amountBigInt} wei`);

        // 计算scaled
        const scaled = (amountBigInt * RAY) / supplyIndex;
        console.log(`  scaled值: ${scaled}`);

        if (scaled === 0n) {
            console.log(`  ⚠️ scaled = 0，会导致InvalidAmount`);
        }

        // 实际测试
        await usdc.connect(deployer).mint(user.address, amountBigInt);
        await usdc.connect(user).approve(pool.target, amountBigInt);

        try {
            const tx = await pool.connect(user).deposit({
                asset: usdc.target,
                amount: amountBigInt,
                onBehalfOf: user.address
            });
            await tx.wait();
            console.log(`  ✅ 存款成功`);
        } catch (error) {
            console.log(`  ❌ 存款失败: ${error.message}`);

            if (error.message.includes("panic code 0x11")) {
                console.log(`  🔍 这是算术溢出错误！`);

                // 进一步分析
                console.log(`    详细分析:`);
                console.log(`    amount: ${amountBigInt}`);
                console.log(`    RAY: ${RAY}`);
                console.log(`    supplyIndex: ${supplyIndex}`);
                console.log(`    amount * RAY: ${amountBigInt * RAY}`);
                console.log(`    scaled计算: ${amountBigInt} * ${RAY} / ${supplyIndex} = ${scaled}`);

                // 检查是否乘法溢出
                try {
                    const product = amountBigInt * RAY;
                    console.log(`    乘法结果: ${product} (无溢出)`);
                } catch (e) {
                    console.log(`    ⚠️ 乘法溢出!`);
                }
            }
        }

        // 清理：提取存款
        const currentSupply = await pool.userSupplyBalance(user.address, usdc.target);
        if (currentSupply > 0n) {
            await pool.connect(user).withdraw({
                asset: usdc.target,
                amount: currentSupply,
                to: user.address
            });
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});