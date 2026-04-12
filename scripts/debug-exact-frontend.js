const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 模拟前端精确行为");
    console.log("===================\n");

    // 模拟你的地址
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

    // 1. 检查余额和授权
    console.log("\n1. 检查当前状态:");
    const usdcBalance = await usdc.balanceOf(yourAddress);
    const allowance = await usdc.allowance(yourAddress, addresses.LendingPool);

    console.log(`你的USDC余额: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`你的授权额度: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 2. 模拟前端存款1 USDC
    console.log("\n2. 模拟前端存款1 USDC:");
    const depositAmount1 = ethers.parseUnits("1", 6); // 1 USDC

    // 首先需要授权（模拟前端行为）
    console.log("第一步: 授权...");

    // 使用一个测试账户来模拟（因为我们需要私钥）
    const [deployer] = await ethers.getSigners();

    // 为了测试，我们直接使用deployer账户，但模拟你的地址的情况
    // 实际上，前端会用你的钱包签名

    // 检查是否需要授权
    if (allowance < depositAmount1) {
        console.log(`需要授权 ${ethers.formatUnits(depositAmount1, 6)} USDC`);

        // 注意：这里我们无法真正用你的地址签名，所以用deployer代替
        // 但在实际前端中，会用你的钱包签名
        console.log("（在实际前端中，这里会弹出钱包确认授权）");
    } else {
        console.log("已有足够授权");
    }

    // 3. 构建存款参数（完全按照前端方式）
    console.log("\n3. 构建存款参数:");
    const depositParams = {
        asset: addresses.USDC,
        amount: depositAmount1,
        onBehalfOf: yourAddress
    };

    console.log("存款参数:", {
        asset: depositParams.asset,
        amount: depositParams.amount.toString(),
        amountUSDC: ethers.formatUnits(depositParams.amount, 6),
        onBehalfOf: depositParams.onBehalfOf
    });

    // 4. 检查合约状态
    console.log("\n4. 检查合约状态:");
    const reserveData = await pool.getReserveData(addresses.USDC);
    console.log("supplyIndex:", reserveData.supplyIndex.toString());
    console.log("totalSupplyScaled:", reserveData.totalSupplyScaled.toString());

    const RAY = 1000000000000000000000000000n;
    const scaled = (depositAmount1 * RAY) / reserveData.supplyIndex;
    console.log(`scaled计算: (${depositAmount1} * ${RAY}) / ${reserveData.supplyIndex} = ${scaled}`);

    // 5. 尝试直接调用（使用deployer，但设置onBehalfOf为你的地址）
    console.log("\n5. 尝试存款（使用deployer账户调用）:");

    // 首先给deployer一些USDC，并授权
    await usdc.connect(deployer).mint(deployer.address, depositAmount1);
    await usdc.connect(deployer).approve(addresses.LendingPool, depositAmount1);

    try {
        const tx = await pool.connect(deployer).deposit(depositParams);
        console.log("交易已发送，等待确认...");
        const receipt = await tx.wait();
        console.log("✅ 存款成功！");
        console.log("交易哈希:", receipt.hash);
        console.log("Gas used:", receipt.gasUsed.toString());
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 分析错误
        if (error.message.includes("panic code 0x11")) {
            console.log("\n⚠️ 算术溢出错误分析:");

            // 检查乘法是否溢出
            try {
                const product = depositAmount1 * RAY;
                console.log(`乘法: ${depositAmount1} * ${RAY} = ${product} (无溢出)`);
            } catch (e) {
                console.log(`乘法溢出: ${e.message}`);
            }

            // 检查除法
            console.log(`除法: ${depositAmount1 * RAY} / ${reserveData.supplyIndex} = ${scaled}`);

            if (scaled === 0n) {
                console.log("⚠️ scaled = 0，这会导致InvalidAmount错误，不是算术溢出");
            }
        }

        // 检查revert原因
        if (error.data) {
            console.log("错误数据:", error.data);
        }

        // 检查是否是因为没有授权（但deployer已经授权了）
        if (error.message.includes("ERC20: insufficient allowance")) {
            console.log("⚠️ 授权不足错误");
        }
    }

    // 6. 检查结果
    console.log("\n6. 检查存款结果:");
    const yourSupply = await pool.userSupplyBalance(yourAddress, addresses.USDC);
    const finalUsdcBalance = await usdc.balanceOf(yourAddress);

    console.log(`你在池中的存款: ${ethers.formatUnits(yourSupply, 6)} USDC`);
    console.log(`你的USDC余额: ${ethers.formatUnits(finalUsdcBalance, 6)} USDC`);

    // 7. 测试另一个场景：存款10 USDC
    console.log("\n7. 测试存款10 USDC:");
    const depositAmount10 = ethers.parseUnits("10", 6);

    // 更新参数
    const depositParams10 = {
        asset: addresses.USDC,
        amount: depositAmount10,
        onBehalfOf: yourAddress
    };

    // 给deployer更多USDC并授权
    await usdc.connect(deployer).mint(deployer.address, depositAmount10);
    await usdc.connect(deployer).approve(addresses.LendingPool, depositAmount10);

    try {
        const tx = await pool.connect(deployer).deposit(depositParams10);
        await tx.wait();
        console.log("✅ 10 USDC存款成功！");
    } catch (error) {
        console.log("❌ 10 USDC存款失败:", error.message);
    }

    // 最终状态
    console.log("\n8. 最终状态:");
    const finalSupply = await pool.userSupplyBalance(yourAddress, addresses.USDC);
    console.log(`你在池中的总存款: ${ethers.formatUnits(finalSupply, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});