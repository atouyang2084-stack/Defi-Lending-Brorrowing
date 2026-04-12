const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 诊断授权失败问题");
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

    console.log("1. 用户报告的问题:");
    console.log("   '有时候弹窗会显示授权额度不足，就会失败'");
    console.log("   可能意味着: 授权交易失败，或者授权检查有问题");

    console.log("\n2. 检查当前状态:");
    const initialBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const initialAllowance = await usdc.allowance(user.address, await pool.getAddress());
    const userUsdcBalance = await usdc.balanceOf(user.address);

    console.log("   借款余额:", ethers.formatUnits(initialBorrowBalance, 6), "USDC");
    console.log("   当前授权:", ethers.formatUnits(initialAllowance, 6), "USDC");
    console.log("   USDC余额:", ethers.formatUnits(userUsdcBalance, 6), "USDC");

    console.log("\n3. 模拟前端授权流程:");

    const repayAmount = ethers.parseUnits("1", 6);
    console.log("   还款金额:", ethers.formatUnits(repayAmount, 6), "USDC");

    // 清除授权，模拟需要授权
    console.log("\n4. 清除现有授权（模拟需要授权）:");
    if (initialAllowance > 0n) {
        console.log("   发送取消授权交易...");
        const revokeTx = await usdc.connect(user).approve(await pool.getAddress(), 0n);
        await revokeTx.wait();
        console.log("   ✅ 授权已清除");
    }

    const afterRevokeAllowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   清除后授权:", ethers.formatUnits(afterRevokeAllowance, 6), "USDC");

    console.log("\n5. 模拟前端授权检查:");
    console.log("   前端检查: allowance.allowance =", ethers.formatUnits(afterRevokeAllowance, 6), "USDC");
    console.log("   需要授权: amountBigInt =", ethers.formatUnits(repayAmount, 6), "USDC");
    console.log("   检查结果: allowance.allowance < amountBigInt?", afterRevokeAllowance < repayAmount);

    if (afterRevokeAllowance < repayAmount) {
        console.log("   前端显示: 'Approve' 按钮");
    }

    console.log("\n6. 模拟用户点击'Approve':");
    console.log("   前端调用: allowance.approve(amountBigInt)");
    console.log("   参数: amount =", repayAmount.toString(), "(不是0，所以不会用最大值)");

    console.log("\n7. 可能的授权失败原因:");
    console.log("   a) 用户USDC余额不足（但授权不需要余额）");
    console.log("   b) 用户拒绝了MetaMask交易");
    console.log("   c) 网络问题");
    console.log("   d) 合约问题");

    console.log("\n8. 测试授权交易:");
    try {
        console.log("   发送授权交易...");
        const approveTx = await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
        console.log("   授权交易哈希:", approveTx.hash);

        console.log("   等待授权确认...");
        const receipt = await approveTx.wait();
        console.log("   ✅ 授权成功，区块:", receipt.blockNumber);

        const newAllowance = await usdc.allowance(user.address, await pool.getAddress());
        console.log("   新授权额度:", ethers.formatUnits(newAllowance, 6), "USDC");

        console.log("\n9. 模拟前端授权成功后的检查:");
        console.log("   前端检查: allowance.isSuccess = true");
        console.log("   前端检查: isRepayApprovalRequested = true");
        console.log("   前端应该自动执行repay");

        // 测试自动repay
        console.log("\n10. 测试自动repay:");
        const repayTx = await pool.connect(user).repay({
            asset: await usdc.getAddress(),
            amount: repayAmount,
            onBehalfOf: user.address
        });
        console.log("   repay交易哈希:", repayTx.hash);
        await repayTx.wait();
        console.log("   ✅ repay成功");

    } catch (error) {
        console.log("   ❌ 授权失败:", error.message);
        if (error.reason) {
            console.log("   错误原因:", error.reason);
        }
        if (error.code) {
            console.log("   错误代码:", error.code);
        }
    }

    console.log("\n11. 前端可能的问题:");
    console.log("   a) 授权检查时机: allowance数据可能没有及时更新");
    console.log("   b) 状态管理: isRepayApprovalRequested可能没有正确设置");
    console.log("   c) 错误处理: 授权失败没有正确处理");
    console.log("   d) 用户反馈: '授权额度不足'错误信息不清晰");

    console.log("\n12. 解决方案:");
    console.log("   1. 增强错误处理，显示具体的授权失败原因");
    console.log("   2. 添加授权状态监控，确保数据及时更新");
    console.log("   3. 使用更大的授权金额（如最大值）避免多次授权");
    console.log("   4. 添加授权重试机制");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});