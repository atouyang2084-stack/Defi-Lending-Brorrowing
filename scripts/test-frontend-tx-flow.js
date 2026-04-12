const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试前端交易流程");
    console.log("===================\n");

    // 模拟前端交易流程
    console.log("前端交易流程模拟:");

    // 1. 用户点击deposit
    console.log("\n1. 用户点击deposit按钮");
    console.log("前端: 检查授权");
    console.log("前端: 如果授权不足，请求授权");
    console.log("前端: 如果授权足够，发送存款交易");

    // 2. MetaMask弹出
    console.log("\n2. MetaMask弹出交易确认");
    console.log("用户: 点击确认");
    console.log("MetaMask: 发送交易到网络");

    // 3. 交易处理
    console.log("\n3. 交易处理");
    console.log("网络: 执行交易");
    console.log("可能结果:");
    console.log("  a) 交易成功 - 状态改变");
    console.log("  b) 交易revert - 状态不变");
    console.log("  c) 交易失败 - Gas不足等");

    // 4. 前端响应
    console.log("\n4. 前端响应");
    console.log("前端使用wagmi的useWriteContract:");
    console.log("  - isPending: 交易发送中");
    console.log("  - isConfirming: 交易确认中");
    console.log("  - isSuccess: 交易成功");
    console.log("  - error: 交易错误");

    // 测试一个常见问题：交易revert但前端认为是成功
    console.log("\n5. 测试交易revert场景");
    console.log("问题: 交易被发送，矿工收取Gas，但合约revert");
    console.log("表现: 交易在区块中，但状态没有改变");
    console.log("前端: 可能显示交易成功（因为交易在链上）");
    console.log("实际: 交易revert了，没有执行逻辑");

    // 检查你的地址的实际交易
    console.log("\n6. 检查你的地址的实际状态变化");
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    // 检查多次存款尝试后的状态
    console.log("\n检查状态变化:");
    const balance = await usdc.balanceOf(yourAddress);
    const supply = await pool.userSupplyBalance(yourAddress, addresses.USDC);
    const allowance = await usdc.allowance(yourAddress, addresses.LendingPool);

    console.log(`USDC余额: ${ethers.formatUnits(balance, 6)}`);
    console.log(`USDC存款: ${ethers.formatUnits(supply, 6)}`);
    console.log(`USDC授权: ${ethers.formatUnits(allowance, 6)}`);

    // 计算应该有的余额
    console.log("\n余额分析:");
    console.log("初始余额: 100,000 USDC（我们铸造的）");
    console.log("当前余额: ", ethers.formatUnits(balance, 6));
    console.log("当前存款: ", ethers.formatUnits(supply, 6));
    console.log("总计: ", ethers.formatUnits(balance + supply, 6));

    if (balance + supply < ethers.parseUnits("100000", 6)) {
        console.log("❌ 余额减少，说明有USDC被转移了");
        console.log("可能被转移到了其他地方，或者Gas费用？");
    } else {
        console.log("✅ 余额正常");
    }

    // 建议的调试步骤
    console.log("\n7. 建议的调试步骤:");
    console.log("步骤1: 检查前端控制台错误");
    console.log("步骤2: 检查MetaMask交易详情");
    console.log("步骤3: 在区块浏览器查看交易（本地Hardhat）");
    console.log("步骤4: 检查交易收据和事件");
    console.log("步骤5: 添加前端交易详情日志");

    // 如何检查本地Hardhat交易
    console.log("\n8. 检查本地Hardhat交易:");
    console.log("Hardhat节点通常运行在 http://localhost:8545");
    console.log("你可以:");
    console.log("1. 查看Hardhat节点控制台输出");
    console.log("2. 使用eth_getTransactionReceipt RPC调用");
    console.log("3. 检查交易是否有revert原因");

    // 前端修复建议
    console.log("\n9. 前端修复建议:");
    console.log("修复1: 添加交易详情日志");
    console.log("console.log('Transaction hash:', deposit.hash);");
    console.log("console.log('Transaction status:', deposit.isSuccess);");
    console.log("console.log('Transaction error:', deposit.error);");

    console.log("\n修复2: 检查交易收据");
    console.log("使用useWaitForTransactionReceipt检查收据");
    console.log("收据包含status字段（0失败，1成功）");

    console.log("\n修复3: 监听合约事件");
    console.log("交易可能成功但没有触发预期事件");
    console.log("需要检查合约是否真的执行了逻辑");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});