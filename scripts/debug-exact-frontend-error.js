const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 精确调试前端错误");
    console.log("===================\n");

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";
    console.log("你的地址:", yourAddress);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("USDC地址:", addresses.USDC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 检查你的余额
    const yourBalance = await usdc.balanceOf(yourAddress);
    console.log(`\n你的USDC余额: ${ethers.formatUnits(yourBalance, 6)} USDC`);

    // 检查你的授权
    const yourAllowance = await usdc.allowance(yourAddress, addresses.LendingPool);
    console.log(`你的授权: ${ethers.formatUnits(yourAllowance, 6)} USDC`);

    // 模拟前端尝试存款1 USDC
    console.log("\n模拟前端存款1 USDC:");

    // 前端计算
    const frontendInput = "1"; // 1 USDC
    const amountFloat = parseFloat(frontendInput);
    const amountBigInt = BigInt(Math.floor(amountFloat * 10 ** 6)); // USDC有6位小数

    console.log(`前端输入: "${frontendInput}" USDC`);
    console.log(`计算后: ${amountBigInt} wei = ${ethers.formatUnits(amountBigInt, 6)} USDC`);

    // 检查是否需要授权
    if (yourAllowance < amountBigInt) {
        console.log(`\n需要授权 ${ethers.formatUnits(amountBigInt, 6)} USDC`);

        // 注意：我们无法用你的地址签名，所以用部署者代替
        // 但在实际前端中，会用你的钱包签名
        console.log("（在实际前端中，这里会弹出钱包确认授权）");
        console.log("由于我们无法用你的私钥签名，无法测试授权步骤");
        console.log("但你的授权目前是0，所以前端应该先请求授权");
    } else {
        console.log("\n已有足够授权");
    }

    // 尝试直接存款（假设已经授权）
    console.log("\n尝试存款（假设已经授权）...");

    // 使用一个测试账户来模拟
    const [deployer] = await ethers.getSigners();

    // 给deployer USDC并授权，然后以你的名义存款
    await usdc.connect(deployer).mint(deployer.address, amountBigInt);
    await usdc.connect(deployer).approve(addresses.LendingPool, amountBigInt);

    try {
        const tx = await pool.connect(deployer).deposit({
            asset: addresses.USDC,
            amount: amountBigInt,
            onBehalfOf: yourAddress  // 存款到你的名下
        });
        await tx.wait();
        console.log("✅ 存款成功（使用deployer账户调用）");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
    }

    // 检查结果
    const yourSupply = await pool.userSupplyBalance(yourAddress, addresses.USDC);
    console.log(`你在池中的存款: ${ethers.formatUnits(yourSupply, 6)} USDC`);

    // 现在测试一个常见的前端问题：授权后立即存款
    console.log("\n\n测试常见前端问题：授权后立即存款");
    console.log("=====================================");

    const testUser = (await ethers.getSigners())[1];
    await usdc.connect(deployer).mint(testUser.address, ethers.parseUnits("10", 6));

    console.log(`测试用户: ${testUser.address}`);
    console.log("余额:", ethers.formatUnits(await usdc.balanceOf(testUser.address), 6), "USDC");

    // 模拟前端：授权然后立即存款
    console.log("\n1. 授权...");
    const approveTx = await usdc.connect(testUser).approve(addresses.LendingPool, ethers.parseUnits("5", 6));
    console.log("授权交易已发送，但前端可能没有等待确认...");

    // 立即尝试存款（模拟前端没有等待授权确认）
    console.log("2. 立即尝试存款（没有等待授权确认）...");
    try {
        const depositTx = await pool.connect(testUser).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser.address
        });
        await depositTx.wait();
        console.log("✅ 存款成功（授权可能已经确认）");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
        console.log("可能原因: 授权交易还没被确认");
    }

    // 等待授权确认后再存款
    console.log("\n3. 等待授权确认后再存款...");
    console.log("等待授权交易确认...");
    await approveTx.wait();
    console.log("授权已确认");

    try {
        const depositTx = await pool.connect(testUser).deposit({
            asset: addresses.USDC,
            amount: ethers.parseUnits("1", 6),
            onBehalfOf: testUser.address
        });
        await depositTx.wait();
        console.log("✅ 存款成功");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
    }

    // 测试前端可能的数据问题
    console.log("\n\n测试前端数据问题");
    console.log("===================");

    // 检查前端可能发送的错误数据
    const testCases = [
        {
            name: "正确参数",
            params: {
                asset: addresses.USDC,
                amount: ethers.parseUnits("1", 6),
                onBehalfOf: testUser.address
            }
        },
        {
            name: "金额为0",
            params: {
                asset: addresses.USDC,
                amount: 0n,
                onBehalfOf: testUser.address
            }
        },
        {
            name: "金额为字符串",
            params: {
                asset: addresses.USDC,
                amount: "1000000", // 字符串而不是bigint
                onBehalfOf: testUser.address
            }
        },
        {
            name: "缺少onBehalfOf",
            params: {
                asset: addresses.USDC,
                amount: ethers.parseUnits("1", 6)
                // 缺少onBehalfOf
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n测试: ${testCase.name}`);
        console.log("参数:", JSON.stringify(testCase.params, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        try {
            // 这里我们无法测试，因为参数类型错误会在编码时失败
            console.log("（参数类型检查会在前端编码时进行）");
        } catch (error) {
            console.log("错误:", error.message);
        }
    }

    // 最后建议
    console.log("\n\n💡 建议调试步骤:");
    console.log("1. 打开浏览器开发者工具（F12）");
    console.log("2. 查看控制台（Console）标签页的错误信息");
    console.log("3. 查看网络（Network）标签页的请求和响应");
    console.log("4. 在前端代码中添加console.log调试");
    console.log("5. 检查钱包（MetaMask）的弹出窗口是否被阻止");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});