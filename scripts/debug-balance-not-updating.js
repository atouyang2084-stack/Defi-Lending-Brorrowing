const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 调试余额不更新问题");
    console.log("=====================\n");

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("你的地址:", yourAddress);
    console.log("USDC地址:", addresses.USDC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 检查当前状态
    console.log("\n1. 检查存款前状态:");
    const balanceBefore = await usdc.balanceOf(yourAddress);
    const allowanceBefore = await usdc.allowance(yourAddress, addresses.LendingPool);
    const supplyBefore = await pool.userSupplyBalance(yourAddress, addresses.USDC);

    console.log(`余额: ${ethers.formatUnits(balanceBefore, 6)} USDC`);
    console.log(`授权: ${ethers.formatUnits(allowanceBefore, 6)} USDC`);
    console.log(`存款: ${ethers.formatUnits(supplyBefore, 6)} USDC`);

    // 模拟存款
    console.log("\n2. 模拟存款10 USDC:");
    const depositAmount = ethers.parseUnits("10", 6);

    // 检查授权
    if (allowanceBefore < depositAmount) {
        console.log(`需要授权 ${ethers.formatUnits(depositAmount, 6)} USDC`);
        console.log("当前授权不足，无法测试");
        return;
    }

    // 使用一个测试账户来存款（因为我们需要私钥）
    const [deployer] = await ethers.getSigners();

    // 给deployer USDC并授权
    await usdc.mint(deployer.address, depositAmount);
    await usdc.connect(deployer).approve(addresses.LendingPool, depositAmount);

    console.log("执行存款交易...");
    const tx = await pool.connect(deployer).deposit({
        asset: addresses.USDC,
        amount: depositAmount,
        onBehalfOf: yourAddress
    });
    const receipt = await tx.wait();
    console.log("✅ 存款交易成功");
    console.log("交易哈希:", receipt.hash);

    // 检查存款后状态
    console.log("\n3. 检查存款后状态:");
    const balanceAfter = await usdc.balanceOf(yourAddress);
    const supplyAfter = await pool.userSupplyBalance(yourAddress, addresses.USDC);

    console.log(`余额: ${ethers.formatUnits(balanceAfter, 6)} USDC`);
    console.log(`存款: ${ethers.formatUnits(supplyAfter, 6)} USDC`);
    console.log(`余额变化: ${ethers.formatUnits(balanceBefore - balanceAfter, 6)} USDC`);
    console.log(`存款变化: ${ethers.formatUnits(supplyAfter - supplyBefore, 6)} USDC`);

    // 分析可能的问题
    console.log("\n4. 分析可能的问题:");

    // 问题1: 前端余额查询没有刷新
    console.log("\n问题1: 前端余额查询没有刷新");
    console.log("表现: 交易成功但前端显示的余额没有更新");
    console.log("原因: useReadContract的data没有自动刷新");
    console.log("解决方案: 交易成功后手动刷新或使用useWatchContractEvent");

    // 问题2: 前端显示的是缓存数据
    console.log("\n问题2: 前端显示的是缓存数据");
    console.log("表现: 前端显示旧数据");
    console.log("原因: React Query缓存");
    console.log("解决方案: 交易成功后invalidate查询");

    // 问题3: 交易实际上没有成功
    console.log("\n问题3: 交易实际上没有成功");
    console.log("表现: 交易确认但状态没有改变");
    console.log("原因: 可能交易revert了但前端没有检测到");
    console.log("检查: 查看交易收据和事件");

    // 检查交易事件
    console.log("\n5. 检查交易事件:");
    const depositEvent = receipt.logs.find(log => {
        try {
            const parsed = pool.interface.parseLog(log);
            return parsed && parsed.name === 'Deposited';
        } catch {
            return false;
        }
    });

    if (depositEvent) {
        const parsed = pool.interface.parseLog(depositEvent);
        console.log("找到Deposited事件:");
        console.log(`  用户: ${parsed.args[0]}`);
        console.log(`  资产: ${parsed.args[1]}`);
        console.log(`  金额: ${ethers.formatUnits(parsed.args[2], 6)} USDC`);
        console.log(`  受益人: ${parsed.args[3]}`);
    } else {
        console.log("❌ 没有找到Deposited事件，交易可能没有成功执行存款");
    }

    // 检查前端代码
    console.log("\n6. 前端代码检查:");
    console.log("前端使用useReadContract获取余额:");
    console.log("const { data: balance } = useReadContract({");
    console.log("  address: tokenAddress,");
    console.log("  abi: erc20ABI,");
    console.log("  functionName: 'balanceOf',");
    console.log("  args: [address],");
    console.log("  query: { enabled: !!address },");
    console.log("});");
    console.log("\n问题: 这个查询不会自动刷新");

    // 建议的解决方案
    console.log("\n7. 建议的解决方案:");
    console.log("方案1: 交易成功后手动刷新");
    console.log("const { data: balance, refetch: refetchBalance } = useReadContract(...);");
    console.log("// 存款成功后");
    console.log("if (deposit.isSuccess) {");
    console.log("    refetchBalance();");
    console.log("}");

    console.log("\n方案2: 使用useWatchContractEvent监听事件");
    console.log("useWatchContractEvent({");
    console.log("  address: tokenAddress,");
    console.log("  abi: erc20ABI,");
    console.log("  eventName: 'Transfer',");
    console.log("  args: { from: address }, // 监听从用户地址转出的交易");
    console.log("  onLogs: () => refetchBalance(), // 事件触发时刷新余额");
    console.log("});");

    console.log("\n方案3: 添加刷新按钮");
    console.log("<button onClick={() => refetchBalance()}>刷新余额</button>");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});