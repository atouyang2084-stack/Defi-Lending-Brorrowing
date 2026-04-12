const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 模拟前端repay调用");
    console.log("====================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 模拟前端参数:");
    const repayAmount = ethers.parseUnits("1", 6);
    const repayParams = {
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    };

    console.log("   repayParams:", JSON.stringify({
        ...repayParams,
        amount: repayAmount.toString(),
        amountHex: '0x' + repayAmount.toString(16)
    }));

    console.log("\n2. 检查用户状态:");
    const userBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const userUsdcBalance = await usdc.balanceOf(user.address);
    const allowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(userBorrowBalance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(userUsdcBalance, 6), "USDC");
    console.log("   授权额度:", ethers.formatUnits(allowance, 6), "USDC");

    console.log("\n3. 模拟前端调用流程:");

    // 检查是否有借款余额
    if (userBorrowBalance === 0n) {
        console.log("   ❌ 错误: 没有借款余额，无需还款");
        return;
    }

    // 检查还款金额是否超过借款余额
    if (repayAmount > userBorrowBalance) {
        console.log(`   ❌ 错误: 还款金额超过借款余额 (最大: ${ethers.formatUnits(userBorrowBalance, 6)} USDC)`);
        return;
    }

    // 检查余额
    if (userUsdcBalance < repayAmount) {
        console.log(`   ❌ 错误: 余额不足 (需要: ${ethers.formatUnits(repayAmount, 6)} USDC, 拥有: ${ethers.formatUnits(userUsdcBalance, 6)} USDC)`);
        return;
    }

    // 检查授权
    if (allowance < repayAmount) {
        console.log(`   ⚠️ 授权不足，需要授权 (需要: ${ethers.formatUnits(repayAmount, 6)} USDC, 已授权: ${ethers.formatUnits(allowance, 6)} USDC)`);
        console.log("   前端应该先调用approve");
        return;
    }

    console.log("   ✅ 所有检查通过，可以执行还款");

    console.log("\n4. 执行还款:");
    try {
        console.log("   调用pool.repay...");
        const tx = await pool.connect(user).repay(repayParams);
        console.log("   ✅ 交易已发送:", tx.hash);

        console.log("   等待交易确认...");
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

    console.log("\n5. 常见前端问题排查:");
    console.log("   a) 检查钱包是否连接");
    console.log("   b) 检查网络是否正确 (localhost:8545, chainId: 31337)");
    console.log("   c) 检查合约地址是否正确");
    console.log("   d) 检查ABI是否正确");
    console.log("   e) 检查参数格式: args: [repayParams]");
    console.log("   f) 检查控制台是否有错误日志");
    console.log("   g) 检查用户是否拒绝了交易");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});