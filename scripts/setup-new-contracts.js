const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔄 设置新合约环境");
    console.log("=================\n");

    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);

    // 读取新的合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";

    console.log("你的地址:", yourAddress);
    console.log("新USDC地址:", addresses.USDC);

    // 1. 给你的地址铸造USDC
    console.log("\n1. 给你的地址铸造USDC...");
    const usdcAmount = ethers.parseUnits("100000", 6);
    const mintTx = await usdc.mint(yourAddress, usdcAmount);
    await mintTx.wait();
    console.log(`✅ 铸造 ${ethers.formatUnits(usdcAmount, 6)} USDC 完成`);

    // 2. 检查余额
    const balance = await usdc.balanceOf(yourAddress);
    console.log(`你的USDC余额: ${ethers.formatUnits(balance, 6)} USDC`);

    // 3. 测试新的MockERC20是否工作正常
    console.log("\n2. 测试新的MockERC20...");

    // 测试transferFrom（没有授权的情况）
    console.log("测试transferFrom（没有授权）:");
    try {
        const tx = await usdc.transferFrom(yourAddress, deployer.address, ethers.parseUnits("1", 6));
        await tx.wait();
        console.log("❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("✅ 正确失败（没有授权）");
        console.log("错误信息:", error.message);

        if (error.message.includes("panic code 0x11")) {
            console.log("⚠️ 仍然是算术溢出错误，MockERC20修复可能没生效");
        } else if (error.message.includes("revert")) {
            console.log("✅ 现在是revert错误，不是算术溢出");
        }
    }

    // 测试transferFrom（有授权的情况）
    console.log("\n测试transferFrom（有授权）:");
    // 先授权
    await usdc.connect(deployer).approve(deployer.address, ethers.parseUnits("10", 6));

    try {
        const tx = await usdc.transferFrom(deployer.address, yourAddress, ethers.parseUnits("1", 6));
        await tx.wait();
        console.log("✅ transferFrom成功（有授权）");
    } catch (error) {
        console.log("❌ transferFrom失败:", error.message);
    }

    // 4. 测试存款
    console.log("\n3. 测试存款功能...");
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = LendingPool.attach(addresses.LendingPool);

    // 先授权
    console.log("授权给LendingPool...");
    const approveTx = await usdc.connect(deployer).approve(addresses.LendingPool, ethers.parseUnits("10", 6));
    await approveTx.wait();

    // 存款
    console.log("存款1 USDC...");
    try {
        const depositTx = await pool.connect(deployer).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: deployer.address
        });
        await depositTx.wait();
        console.log("✅ 存款成功！");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
    }

    // 5. 测试没有授权的情况
    console.log("\n4. 测试没有授权的情况:");
    const testUser = (await ethers.getSigners())[1];
    await usdc.mint(testUser.address, ethers.parseUnits("10", 6));

    try {
        const tx = await pool.connect(testUser).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("✅ 存款失败（没有授权）");
        console.log("错误信息:", error.message);

        if (error.message.includes("panic code 0x11")) {
            console.log("⚠️ 仍然是算术溢出错误");
        } else if (error.message.includes("InsufficientLiquidity")) {
            console.log("✅ 现在是InsufficientLiquidity错误（来自_safeTransferFrom）");
        }
    }

    console.log("\n🎉 设置完成！");
    console.log("现在你可以：");
    console.log("1. 启动前端: cd frontend && npm run dev");
    console.log("2. 访问 http://localhost:5174");
    console.log("3. 连接你的钱包");
    console.log("4. 尝试存款");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});