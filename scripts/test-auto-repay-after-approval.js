const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试授权后自动repay流程");
    console.log("===========================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("用户地址:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("1. 模拟用户操作流程:");
    console.log("   a) 用户打开页面，有借款余额");
    console.log("   b) 用户输入还款金额，点击'Repay'");
    console.log("   c) 前端检查授权不足，显示'Approve'按钮");
    console.log("   d) 用户点击'Approve'，确认MetaMask授权");
    console.log("   e) 授权成功后，前端应该自动执行repay");
    console.log("   f) 用户不应该需要再次点击'Repay'");

    console.log("\n2. 检查当前状态:");
    const initialBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const initialAllowance = await usdc.allowance(user.address, await pool.getAddress());

    console.log("   借款余额:", ethers.formatUnits(initialBorrowBalance, 6), "USDC");
    console.log("   当前授权:", ethers.formatUnits(initialAllowance, 6), "USDC");

    // 清除授权，模拟需要授权的情况
    console.log("\n3. 模拟需要授权的场景:");
    if (initialAllowance > 0n) {
        console.log("   清除现有授权...");
        await usdc.connect(user).approve(await pool.getAddress(), 0n);
        console.log("   授权已清除");
    }

    const repayAmount = ethers.parseUnits("1", 6);
    console.log("   还款金额:", ethers.formatUnits(repayAmount, 6), "USDC");

    console.log("\n4. 模拟前端逻辑:");
    console.log("   步骤1: 用户点击repay按钮");
    console.log("   步骤2: 前端检查授权");
    console.log("   当前授权: 0 USDC");
    console.log("   需要授权:", ethers.formatUnits(repayAmount, 6), "USDC");
    console.log("   结果: 授权不足，显示'Approve'按钮");

    console.log("\n5. 模拟用户点击'Approve':");
    console.log("   发送授权交易...");
    const approveTx = await usdc.connect(user).approve(await pool.getAddress(), repayAmount);
    console.log("   授权交易哈希:", approveTx.hash);

    console.log("   等待授权确认...");
    await approveTx.wait();
    console.log("   ✅ 授权成功");

    const newAllowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log("   新授权额度:", ethers.formatUnits(newAllowance, 6), "USDC");

    console.log("\n6. 关键点: 授权成功后前端应该自动执行repay");
    console.log("   不应该需要用户再次点击'Repay'按钮");

    console.log("\n7. 验证自动repay逻辑:");
    console.log("   前端应该检测到allowance.isSuccess === true");
    console.log("   前端应该检测到isRepayApprovalRequested === true");
    console.log("   前端应该检测到action === 'repay'");
    console.log("   前端应该自动调用repay.repay()");

    // 模拟自动repay
    console.log("\n8. 模拟自动repay执行:");
    console.log("   执行repay...");
    const repayTx = await pool.connect(user).repay({
        asset: await usdc.getAddress(),
        amount: repayAmount,
        onBehalfOf: user.address
    });
    console.log("   repay交易哈希:", repayTx.hash);

    await repayTx.wait();
    console.log("   ✅ repay成功");

    const finalBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log("   最终借款余额:", ethers.formatUnits(finalBorrowBalance, 6), "USDC");

    console.log("\n9. 问题总结:");
    console.log("   用户报告: '每次成功的都是没有出现授权弹窗的'");
    console.log("   这意味着: 当需要授权时，授权成功后repay没有自动执行");
    console.log("   用户需要手动再次点击'Repay'按钮");

    console.log("\n10. 修复方案:");
    console.log("   添加isRepayApprovalRequested状态");
    console.log("   用户点击'Approve'时设置isRepayApprovalRequested = true");
    console.log("   添加useEffect监听allowance.isSuccess");
    console.log("   当allowance.isSuccess && isRepayApprovalRequested时自动执行repay");
    console.log("   按钮文本: 授权中显示'Approving...'，授权不足显示'Approve'，足够显示'Repay'");

    console.log("\n11. 用户期望的流程:");
    console.log("   1. 输入金额 → 点击按钮（显示'Approve'）");
    console.log("   2. 确认MetaMask授权");
    console.log("   3. 等待授权确认（按钮显示'Approving...'）");
    console.log("   4. 授权成功 → 自动执行repay");
    console.log("   5. 等待repay确认");
    console.log("   6. repay成功 → 数据刷新");
    console.log("   整个过程用户只需要点击一次按钮！");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});