const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 调试授权问题");
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

    // 模拟前端场景
    console.log("\n模拟前端场景:");

    // 1. 用户有USDC
    await usdc.connect(deployer).mint(user.address, ethers.parseUnits("100", 6));
    console.log("1. 用户有100 USDC");

    // 2. 检查授权（模拟useAllowance hook）
    const allowance = await usdc.allowance(user.address, addresses.LendingPool);
    console.log(`2. 当前授权: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 3. 用户输入1 USDC
    const amountBigInt = ethers.parseUnits("1", 6);
    console.log(`3. 用户想存款: ${ethers.formatUnits(amountBigInt, 6)} USDC`);

    // 4. 前端逻辑：检查授权
    console.log("\n前端逻辑:");
    console.log(`allowance = ${ethers.formatUnits(allowance, 6)}`);
    console.log(`amountBigInt = ${ethers.formatUnits(amountBigInt, 6)}`);
    console.log(`allowance < amountBigInt? ${allowance < amountBigInt}`);

    if (allowance < amountBigInt) {
        console.log("需要授权...");

        // 模拟前端授权
        console.log("调用allowance.approve(amountBigInt)...");

        try {
            const approveTx = await usdc.connect(user).approve(addresses.LendingPool, amountBigInt);
            console.log("授权交易已发送，等待确认...");
            await approveTx.wait();
            console.log("✅ 授权成功");

            // 检查新授权
            const newAllowance = await usdc.allowance(user.address, addresses.LendingPool);
            console.log(`新授权: ${ethers.formatUnits(newAllowance, 6)} USDC`);
        } catch (error) {
            console.log("❌ 授权失败:", error.message);
        }
    } else {
        console.log("已有足够授权，直接存款...");
    }

    // 5. 尝试存款（无论授权是否成功）
    console.log("\n尝试存款...");
    try {
        const tx = await pool.connect(user).deposit({
            asset: addresses.USDC,
            amount: amountBigInt,
            onBehalfOf: user.address
        });
        await tx.wait();
        console.log("✅ 存款成功");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 检查具体错误
        if (error.message.includes("panic code 0x11")) {
            console.log("\n⚠️ 这是算术溢出错误！");
            console.log("但我们的测试显示，当没有授权时，ERC20.transferFrom会失败");
            console.log("可能的原因:");
            console.log("1. 合约的_safeTransferFrom函数有问题");
            console.log("2. MockERC20的实现有问题");

            // 检查_safeTransferFrom
            console.log("\n检查_safeTransferFrom逻辑...");
            // 我们无法直接读取内部函数，但可以测试transferFrom
            console.log("测试直接transferFrom:");

            try {
                const transferTx = await usdc.connect(user).transferFrom(
                    user.address,
                    addresses.LendingPool,
                    amountBigInt
                );
                await transferTx.wait();
                console.log("✅ transferFrom成功（说明授权有效）");
            } catch (e) {
                console.log("❌ transferFrom失败:", e.message);
            }
        }
    }

    // 6. 测试另一个场景：授权为0的情况
    console.log("\n\n测试场景：授权为0");
    const newUser = (await ethers.getSigners())[2];
    await usdc.connect(deployer).mint(newUser.address, ethers.parseUnits("10", 6));

    console.log(`新用户: ${newUser.address}`);
    console.log("授权: 0 USDC");

    // 不授权，直接尝试存款
    try {
        const tx = await pool.connect(newUser).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: newUser.address
        });
        await tx.wait();
        console.log("❌ 不应该成功（没有授权）");
    } catch (error) {
        console.log("✅ 存款失败（没有授权）");
        console.log("错误信息:", error.message);

        // 检查错误类型
        if (error.message.includes("panic code 0x11")) {
            console.log("\n⚠️ 重要发现：");
            console.log("当没有授权时，合约返回的是算术溢出错误，而不是ERC20错误！");
            console.log("这可能是因为_safeTransferFrom函数中的错误处理有问题。");
        }
    }

    // 7. 检查_safeTransferFrom的实现
    console.log("\n检查_safeTransferFrom实现（通过代码分析）:");
    console.log("在LendingPool.sol中，_safeTransferFrom调用IERC20(asset).transferFrom");
    console.log("如果transferFrom失败，应该返回ERC20错误，而不是算术溢出");
    console.log("除非...MockERC20的transferFrom有bug！");

    // 8. 测试MockERC20的transferFrom
    console.log("\n测试MockERC20.transferFrom:");
    const testUser1 = (await ethers.getSigners())[3];
    const testUser2 = (await ethers.getSigners())[4];

    await usdc.connect(deployer).mint(testUser1.address, ethers.parseUnits("10", 6));

    // 先授权
    await usdc.connect(testUser1).approve(testUser2.address, ethers.parseUnits("5", 6));

    try {
        const tx = await usdc.connect(testUser2).transferFrom(
            testUser1.address,
            testUser2.address,
            ethers.parseUnits("3", 6)
        );
        await tx.wait();
        console.log("✅ MockERC20.transferFrom工作正常");
    } catch (error) {
        console.log("❌ MockERC20.transferFrom失败:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});