const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试前端逻辑");
    console.log("===============\n");

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

    // 模拟前端场景
    console.log("\n模拟前端存款流程:");

    // 1. 用户有USDC
    await usdc.connect(deployer).mint(user.address, ethers.parseUnits("100", 6));
    console.log("1. 用户有100 USDC");

    // 2. 检查授权（模拟useAllowance hook）
    const allowance = await usdc.allowance(user.address, addresses.LendingPool);
    console.log(`2. 当前授权: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 3. 用户输入10 USDC
    const amountBigInt = ethers.parseUnits("10", 6);
    console.log(`3. 用户想存款: ${ethers.formatUnits(amountBigInt, 6)} USDC`);

    // 4. 前端逻辑
    console.log("\n前端逻辑检查:");
    console.log(`allowance.data = ${ethers.formatUnits(allowance, 6)} (模拟)`);
    console.log(`amountBigInt = ${ethers.formatUnits(amountBigInt, 6)}`);
    console.log(`allowance.data < amountBigInt? ${allowance < amountBigInt}`);

    if (allowance < amountBigInt) {
        console.log("需要授权...");

        // 模拟前端授权
        console.log("调用allowance.approve(amountBigInt)...");

        try {
            const approveTx = await usdc.connect(user).approve(addresses.LendingPool, amountBigInt);
            await approveTx.wait();
            console.log("✅ 授权成功");

            // 检查新授权
            const newAllowance = await usdc.allowance(user.address, addresses.LendingPool);
            console.log(`新授权: ${ethers.formatUnits(newAllowance, 6)} USDC`);
        } catch (error) {
            console.log("❌ 授权失败:", error.message);
            return;
        }
    } else {
        console.log("已有足够授权，直接存款...");
    }

    // 5. 尝试存款
    console.log("\n尝试存款...");
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: amountBigInt,
            onBehalfOf: user.address
        });
        const receipt = await tx.wait();
        console.log("✅ 存款成功");
        console.log("交易哈希:", receipt.hash);
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 分析错误
        if (error.message.includes("InsufficientLiquidity")) {
            console.log("错误: InsufficientLiquidity (来自_safeTransferFrom)");
            console.log("可能原因: 授权仍然不足或MockERC20返回false");
        }
    }

    // 6. 测试repay（即使没有债务）
    console.log("\n\n测试repay流程:");
    console.log("用户没有债务，但尝试还款...");

    const repayAmount = ethers.parseUnits("1", 6);

    // 先授权
    await usdc.connect(user).approve(addresses.LendingPool, repayAmount);

    try {
        const tx = await pool.connect(user).repay({
            asset: addresses.USDC,
            amount: repayAmount,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("✅ repay成功（即使没有债务）");
        console.log("这可能是因为repay函数允许偿还0债务？");
    } catch (error) {
        console.log("❌ repay失败:", error.message);
    }

    // 7. 检查合约中的repay函数逻辑
    console.log("\n检查repay函数逻辑:");
    console.log("在LendingPool.sol中，repay函数:");
    console.log("1. 检查amount > 0");
    console.log("2. 调用_safeTransferFrom转移代币");
    console.log("3. 计算scaledToBurn = (amount * RAY) / borrowIndex");
    console.log("4. 如果scaledToBurn > userBorrowScaled，则只burn userBorrowScaled");
    console.log("5. 所以即使没有债务，repay也可能成功（只是burn 0）");

    // 8. 测试实际没有授权的情况
    console.log("\n测试没有授权的情况:");
    const testUser = (await ethers.getSigners())[2];
    await usdc.connect(deployer).mint(testUser.address, ethers.parseUnits("10", 6));

    console.log("新用户，授权为0，尝试存款...");
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
    }

    console.log("\n新用户，授权为0，尝试repay...");
    try {
        const tx = await pool.connect(testUser).repay({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("✅ repay失败（没有授权）");
        console.log("错误信息:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});