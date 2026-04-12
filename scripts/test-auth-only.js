const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 专门测试授权问题");
    console.log("===================\n");

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
    console.log("用户有100 USDC");

    // 测试1: 没有授权，尝试存款
    console.log("\n测试1: 没有授权，尝试存款");
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("✅ 存款失败（没有授权）");
        console.log("错误:", error.message);
    }

    // 测试2: 授权但金额不足
    console.log("\n测试2: 授权但金额不足");
    // 先授权1 USDC
    await usdc.connect(user).approve(addresses.LendingPool, ethers.parseUnits("1", 6));
    console.log("授权1 USDC");

    // 尝试存款2 USDC
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("2", 6),
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（授权不足）");
    } catch (error) {
        console.log("✅ 存款失败（授权不足）");
        console.log("错误:", error.message);
    }

    // 测试3: 正确授权，尝试存款
    console.log("\n测试3: 正确授权，尝试存款");
    // 授权10 USDC
    await usdc.connect(user).approve(addresses.LendingPool, ethers.parseUnits("10", 6));
    console.log("授权10 USDC");

    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("5", 6),
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("✅ 存款成功");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
    }

    // 测试4: 检查前端可能的问题 - 授权后立即存款
    console.log("\n测试4: 模拟前端授权后立即存款问题");
    const testUser = (await ethers.getSigners())[2];
    await usdc.connect(deployer).mint(testUser.address, ethers.parseUnits("10", 6));

    console.log("发送授权交易...");
    const approveTx = await usdc.connect(testUser).approve(addresses.LendingPool, ethers.parseUnits("5", 6));

    console.log("立即尝试存款（不等待授权确认）...");
    try {
        const depositTx = await pool.connect(testUser).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser.address
        });
        await depositTx.wait();
        console.log("✅ 存款成功（授权可能已经快速确认）");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
        console.log("可能原因: 授权交易还没被确认");
    }

    // 测试5: 检查实际余额
    console.log("\n测试5: 检查余额和授权状态");
    const userBalance = await usdc.balanceOf(user.address);
    const userAllowance = await usdc.allowance(user.address, addresses.LendingPool);
    const userSupply = await pool.userSupplyBalance(user.address, addresses.USDC);

    console.log(`用户USDC余额: ${ethers.formatUnits(userBalance, 6)}`);
    console.log(`用户授权额度: ${ethers.formatUnits(userAllowance, 6)}`);
    console.log(`用户在池中存款: ${ethers.formatUnits(userSupply, 6)}`);

    // 测试6: 模拟前端useAllowance hook
    console.log("\n测试6: 模拟useAllowance hook行为");
    console.log("useAllowance会返回:");
    console.log("- data: 当前授权额度");
    console.log("- isLoading: 是否在加载");
    console.log("- approve: 授权函数");
    console.log("- isPending: 授权交易是否pending");
    console.log("- isConfirming: 授权交易是否在确认中");
    console.log("- isSuccess: 授权交易是否成功");

    // 前端逻辑模拟
    const mockAllowance = {
        data: userAllowance,
        isLoading: false,
        approve: (amount) => {
            console.log(`前端调用approve(${ethers.formatUnits(amount, 6)} USDC)`);
            return usdc.connect(user).approve(addresses.LendingPool, amount);
        },
        isPending: false,
        isConfirming: false,
        isSuccess: true
    };

    console.log("\n模拟前端存款逻辑:");
    const frontendAmount = ethers.parseUnits("3", 6);
    console.log(`用户想存款: ${ethers.formatUnits(frontendAmount, 6)} USDC`);
    console.log(`当前授权: ${ethers.formatUnits(mockAllowance.data, 6)} USDC`);

    if (mockAllowance.data < frontendAmount) {
        console.log("需要授权...");
        // 前端会调用mockAllowance.approve(frontendAmount)
    } else {
        console.log("已有足够授权");
    }

    // 测试7: 检查前端错误处理
    console.log("\n测试7: 检查前端错误处理");
    console.log("deposit.error:", "前端会显示这个错误");
    console.log("allowance.error:", "前端会显示授权错误");

    // 建议
    console.log("\n💡 基于测试的建议:");
    console.log("1. 检查前端是否在存款前正确检查授权");
    console.log("2. 检查前端是否等待授权交易确认");
    console.log("3. 检查前端错误处理是否显示错误信息");
    console.log("4. 检查钱包（MetaMask）是否弹出授权窗口");
    console.log("5. 检查网络连接是否正确（Hardhat本地网络）");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});