const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 模拟前端存款流程");
    console.log("===================\n");

    // 模拟两个账户：一个是你（有USDC），另一个是调用者
    const [deployer, caller] = await ethers.getSigners();

    // 你的地址（有USDC）
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";
    console.log("你的地址（有USDC）:", yourAddress);
    console.log("调用者地址:", caller.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("USDC地址:", await usdc.getAddress());
    console.log("LendingPool地址:", await pool.getAddress());

    // 1. 首先，我们需要将一些USDC转移到调用者账户，模拟前端钱包
    console.log("\n1. 准备测试环境...");
    const transferAmount = ethers.parseUnits("100", 6);

    // 使用部署者账户从你的地址转移USDC到调用者账户
    // 注意：这需要你的地址的私钥，但我们没有，所以用另一种方式
    // 我们直接给调用者铸造一些USDC
    console.log("给调用者铸造100 USDC...");
    const mintTx = await usdc.connect(deployer).mint(caller.address, transferAmount);
    await mintTx.wait();

    const callerUsdcBalance = await usdc.balanceOf(caller.address);
    console.log(`调用者USDC余额: ${ethers.formatUnits(callerUsdcBalance, 6)} USDC`);

    // 2. 调用者授权给LendingPool
    console.log("\n2. 授权...");
    const depositAmount = ethers.parseUnits("10", 6);
    const approveTx = await usdc.connect(caller).approve(await pool.getAddress(), depositAmount);
    await approveTx.wait();

    const allowance = await usdc.allowance(caller.address, await pool.getAddress());
    console.log(`调用者授权额度: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 3. 调用者存款（onBehalfOf设置为你的地址）
    console.log(`\n3. 存款10 USDC（onBehalfOf: ${yourAddress}）...`);

    try {
        const depositTx = await pool.connect(caller).deposit({
            asset: await usdc.getAddress(),
            amount: depositAmount,
            onBehalfOf: yourAddress  // 存款到你的地址名下
        });
        await depositTx.wait();
        console.log("✅ 存款成功！");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 详细错误分析
        if (error.message.includes("reverted with panic code 0x11")) {
            console.log("\n⚠️ 检测到算术溢出错误 (panic code 0x11)");
            console.log("可能的原因:");
            console.log("1. depositAmount太小，导致scaled计算为0");
            console.log("2. supplyIndex太大");
            console.log("3. 其他算术溢出");

            // 检查具体数值
            const reserveData = await pool.getReserveData(await usdc.getAddress());
            const RAY = await pool.RAY();

            console.log(`\n详细数值:`);
            console.log(`depositAmount: ${depositAmount}`);
            console.log(`RAY: ${RAY}`);
            console.log(`supplyIndex: ${reserveData.supplyIndex}`);

            // 计算 scaled
            const scaled = (depositAmount * RAY) / reserveData.supplyIndex;
            console.log(`scaled = (${depositAmount} * ${RAY}) / ${reserveData.supplyIndex} = ${scaled}`);

            if (scaled === 0n) {
                console.log("\n⚠️ 问题: scaled = 0");
                console.log("这意味着存款金额太小，或者supplyIndex太大");
                console.log("合约要求 scaled > 0，否则会revert");

                // 计算最小存款金额
                const minDeposit = (reserveData.supplyIndex + RAY - 1n) / RAY;
                console.log(`最小存款金额: ${minDeposit} (${ethers.formatUnits(minDeposit, 6)} USDC)`);
            }
        }
    }

    // 4. 检查结果
    console.log("\n4. 检查结果...");
    const finalCallerUsdcBalance = await usdc.balanceOf(caller.address);
    const yourSupply = await pool.userSupplyBalance(yourAddress, await usdc.getAddress());

    console.log(`调用者USDC余额: ${ethers.formatUnits(finalCallerUsdcBalance, 6)} USDC`);
    console.log(`你在池中的存款: ${ethers.formatUnits(yourSupply, 6)} USDC`);

    // 5. 现在测试直接存款到调用者自己账户
    console.log("\n5. 测试直接存款到调用者自己账户...");
    const selfDepositAmount = ethers.parseUnits("1", 6); // 1 USDC

    // 先授权
    const selfApproveTx = await usdc.connect(caller).approve(await pool.getAddress(), selfDepositAmount);
    await selfApproveTx.wait();

    try {
        const selfDepositTx = await pool.connect(caller).deposit({
            asset: await usdc.getAddress(),
            amount: selfDepositAmount,
            onBehalfOf: caller.address  // 存款到自己账户
        });
        await selfDepositTx.wait();
        console.log("✅ 直接存款成功！");
    } catch (error) {
        console.log("❌ 直接存款失败:", error.message);
    }

    const callerSupply = await pool.userSupplyBalance(caller.address, await usdc.getAddress());
    console.log(`调用者在池中的存款: ${ethers.formatUnits(callerSupply, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});