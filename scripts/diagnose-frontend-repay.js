const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 诊断前端repay问题");
    console.log("====================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("测试用户:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const wbtc = MockERC20.attach(addresses.WBTC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 检查合约地址:");
    console.log("   USDC:", await usdc.getAddress());
    console.log("   WBTC:", await wbtc.getAddress());
    console.log("   LendingPool:", await pool.getAddress());

    console.log("\n2. 检查用户状态:");
    const userUsdcBalance = await usdc.balanceOf(user.address);
    const userWbtcBalance = await wbtc.balanceOf(user.address);
    console.log("   USDC余额:", ethers.formatUnits(userUsdcBalance, 6), "USDC");
    console.log("   WBTC余额:", ethers.formatUnits(userWbtcBalance, 8), "WBTC");

    // 检查是否有借款
    const userBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("   USDC借款余额:", ethers.formatUnits(userBorrowBalance, 6), "USDC");

    // 如果没有借款，创建测试场景
    if (userBorrowBalance === 0n) {
        console.log("\n3. 创建测试借款场景...");

        // 部署者存款提供流动性
        const depositAmount = ethers.parseUnits("1000", 6);
        await usdc.connect(deployer).approve(await pool.getAddress(), depositAmount);
        await pool.connect(deployer).deposit({
            asset: await usdc.getAddress(),
            amount: depositAmount,
            onBehalfOf: deployer.address
        });
        console.log("   ✅ 部署者存款成功");

        // 用户抵押WBTC
        const wbtcAmount = ethers.parseUnits("0.1", 8);
        await wbtc.connect(user).approve(await pool.getAddress(), wbtcAmount);
        await pool.connect(user).deposit({
            asset: await wbtc.getAddress(),
            amount: wbtcAmount,
            onBehalfOf: user.address
        });
        console.log("   ✅ 用户抵押WBTC成功");

        // 用户借款
        const borrowAmount = ethers.parseUnits("10", 6);
        await pool.connect(user).borrow({
            asset: await usdc.getAddress(),
            amount: borrowAmount,
            onBehalfOf: user.address
        });
        console.log("   ✅ 用户借款成功");

        // 更新借款余额
        const newBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
        console.log("   当前借款余额:", ethers.formatUnits(newBorrowBalance, 6), "USDC");
    }

    console.log("\n4. 检查授权状态:");
    const allowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   用户对LendingPool的授权:", ethers.formatUnits(allowance, 6), "USDC");

    console.log("\n5. 模拟前端调用参数:");
    const repayAmount = ethers.parseUnits("1", 6);
    const repayParams = {
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    };

    console.log("   repayParams对象:", JSON.stringify({
        ...repayParams,
        amount: repayAmount.toString(),
        amountHex: '0x' + repayAmount.toString(16)
    }));

    console.log("\n6. 检查ABI编码:");
    const poolInterface = pool.interface;
    const encodedData = poolInterface.encodeFunctionData("repay", [repayParams]);
    console.log("   编码后的数据:", encodedData);
    console.log("   数据长度:", encodedData.length, "字符");

    console.log("\n7. 直接测试repay调用:");
    try {
        // 确保有足够授权
        if (allowance < repayAmount) {
            console.log("   授权不足，正在授权...");
            await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
            console.log("   ✅ 授权成功");
        }

        console.log("   调用repay...");
        const tx = await pool.connect(user).repay(repayParams);
        console.log("   ✅ 交易已发送:", tx.hash);

        const receipt = await tx.wait();
        console.log("   ✅ 交易确认，区块:", receipt.blockNumber);

        // 检查结果
        const afterBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
        console.log("   还款后借款余额:", ethers.formatUnits(afterBorrowBalance, 6), "USDC");

    } catch (error) {
        console.log("   ❌ 调用失败:", error.message);
        if (error.data) {
            console.log("   错误数据:", error.data);
        }
        if (error.reason) {
            console.log("   错误原因:", error.reason);
        }
    }

    console.log("\n8. 检查前端可能的问题:");
    console.log("   a) 确保前端使用正确的合约地址");
    console.log("   b) 确保ABI包含repay函数");
    console.log("   c) 确保参数格式正确: args: [repayParams]");
    console.log("   d) 检查钱包连接状态");
    console.log("   e) 检查网络是否正确 (localhost:8545)");
    console.log("   f) 检查控制台是否有错误日志");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});