const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 调试所有交易问题");
    console.log("===================\n");

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const wbtc = MockERC20.attach(addresses.WBTC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("你的地址:", yourAddress);
    console.log("USDC地址:", addresses.USDC);
    console.log("WBTC地址:", addresses.WBTC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 检查当前状态
    console.log("\n1. 当前状态检查:");
    const usdcBalance = await usdc.balanceOf(yourAddress);
    const wbtcBalance = await wbtc.balanceOf(yourAddress);
    const usdcSupply = await pool.userSupplyBalance(yourAddress, addresses.USDC);
    const wbtcSupply = await pool.userSupplyBalance(yourAddress, addresses.WBTC);
    const usdcBorrow = await pool.userBorrowBalance(yourAddress, addresses.USDC);
    const usdcAllowance = await usdc.allowance(yourAddress, addresses.LendingPool);

    console.log(`USDC余额: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`WBTC余额: ${ethers.formatUnits(wbtcBalance, 8)}`);
    console.log(`USDC存款: ${ethers.formatUnits(usdcSupply, 6)}`);
    console.log(`WBTC存款: ${ethers.formatUnits(wbtcSupply, 8)}`);
    console.log(`USDC借款: ${ethers.formatUnits(usdcBorrow, 6)}`);
    console.log(`USDC授权: ${ethers.formatUnits(usdcAllowance, 6)}`);

    // 检查健康因子
    console.log("\n2. 健康因子检查:");
    const accountData = await pool.userAccountData(yourAddress);
    console.log(`抵押价值: ${ethers.formatUnits(accountData[0], 18)} USD`);
    console.log(`债务价值: ${ethers.formatUnits(accountData[1], 18)} USD`);
    console.log(`加权抵押价值: ${ethers.formatUnits(accountData[2], 18)} USD`);
    console.log(`健康因子: ${ethers.formatUnits(accountData[3], 27)}`);

    // 分析问题
    console.log("\n3. 问题分析:");

    // 问题1: deposit没有效果
    console.log("\n问题1: deposit没有效果");
    console.log("可能原因:");
    console.log("1. 授权不足（但交易可能被发送）");
    console.log("2. 交易revert但前端没有检测到");
    console.log("3. 前端参数错误");
    console.log("4. 合约逻辑问题");

    // 问题2: borrow返回HealthFactorTooLow
    console.log("\n问题2: borrow返回HealthFactorTooLow");
    console.log("可能原因:");
    console.log("1. 没有足够的抵押品");
    console.log("2. 健康因子计算错误");
    console.log("3. 借款金额超过限额");

    // 问题3: repay没有效果
    console.log("\n问题3: repay没有效果");
    console.log("可能原因:");
    console.log("1. 没有债务可还");
    console.log("2. 授权不足");
    console.log("3. 交易revert");

    // 问题4: withdraw有效
    console.log("\n问题4: withdraw有效");
    console.log("这说明:");
    console.log("1. 合约基本功能正常");
    console.log("2. 用户确实有存款");
    console.log("3. 交易能够成功执行");

    // 测试deposit
    console.log("\n4. 测试deposit:");
    const [deployer] = await ethers.getSigners();

    // 给deployer USDC并授权
    const testDepositAmount = ethers.parseUnits("1", 6);
    await usdc.mint(deployer.address, testDepositAmount);
    await usdc.connect(deployer).approve(addresses.LendingPool, testDepositAmount);

    console.log(`测试存款 ${ethers.formatUnits(testDepositAmount, 6)} USDC...`);
    try {
        const tx = await pool.connect(deployer).deposit({
            asset: addresses.USDC,
            amount: testDepositAmount,
            onBehalfOf: deployer.address
        });
        const receipt = await tx.wait();
        console.log("✅ 存款交易成功");

        // 检查事件
        const depositEvent = receipt.logs.find(log => {
            try {
                const parsed = pool.interface.parseLog(log);
                return parsed && parsed.name === 'Deposited';
            } catch {
                return false;
            }
        });

        if (depositEvent) {
            console.log("✅ 找到Deposited事件");
        } else {
            console.log("❌ 没有Deposited事件，交易可能没有执行存款逻辑");
        }
    } catch (error) {
        console.log("❌ 存款失败:", error.message);
    }

    // 测试borrow
    console.log("\n5. 测试borrow:");
    console.log("首先需要抵押品...");

    // 给用户WBTC作为抵押品
    const collateralAmount = ethers.parseUnits("0.1", 8); // 0.1 WBTC
    await wbtc.mint(yourAddress, collateralAmount);
    await wbtc.connect(deployer).approve(addresses.LendingPool, collateralAmount);

    console.log(`给用户 ${ethers.formatUnits(collateralAmount, 8)} WBTC 作为抵押品`);

    // 存款WBTC作为抵押品
    try {
        const tx = await pool.connect(deployer).deposit({
            asset: addresses.WBTC,
            amount: collateralAmount,
            onBehalfOf: yourAddress
        });
        await tx.wait();
        console.log("✅ WBTC存款成功（作为抵押品）");
    } catch (error) {
        console.log("❌ WBTC存款失败:", error.message);
    }

    // 检查新的健康因子
    const newAccountData = await pool.userAccountData(yourAddress);
    console.log(`新的健康因子: ${ethers.formatUnits(newAccountData[3], 27)}`);

    // 尝试借款
    const borrowAmount = ethers.parseUnits("100", 6); // 100 USDC
    console.log(`\n尝试借款 ${ethers.formatUnits(borrowAmount, 6)} USDC...`);

    try {
        const tx = await pool.connect(deployer).borrow({
            asset: addresses.USDC,
            amount: borrowAmount,
            onBehalfOf: yourAddress
        });
        await tx.wait();
        console.log("✅ 借款交易成功");
    } catch (error) {
        console.log("❌ 借款失败:", error.message);
        if (error.message.includes("HealthFactorTooLow")) {
            console.log("健康因子太低，尝试更小的借款金额...");

            // 尝试更小的金额
            const smallBorrowAmount = ethers.parseUnits("10", 6);
            try {
                const tx = await pool.connect(deployer).borrow({
                    asset: addresses.USDC,
                    amount: smallBorrowAmount,
                    onBehalfOf: yourAddress
                });
                await tx.wait();
                console.log(`✅ 借款 ${ethers.formatUnits(smallBorrowAmount, 6)} USDC 成功`);
            } catch (error2) {
                console.log("❌ 小金额借款也失败:", error2.message);
            }
        }
    }

    // 最终状态
    console.log("\n6. 最终状态:");
    const finalUsdcBalance = await usdc.balanceOf(yourAddress);
    const finalUsdcSupply = await pool.userSupplyBalance(yourAddress, addresses.USDC);
    const finalUsdcBorrow = await pool.userBorrowBalance(yourAddress, addresses.USDC);
    const finalAccountData = await pool.userAccountData(yourAddress);

    console.log(`USDC余额: ${ethers.formatUnits(finalUsdcBalance, 6)}`);
    console.log(`USDC存款: ${ethers.formatUnits(finalUsdcSupply, 6)}`);
    console.log(`USDC借款: ${ethers.formatUnits(finalUsdcBorrow, 6)}`);
    console.log(`健康因子: ${ethers.formatUnits(finalAccountData[3], 27)}`);

    // 总结
    console.log("\n7. 问题总结:");
    console.log("如果测试中deposit/borrow成功但前端没有效果:");
    console.log("✅ 合约逻辑正常");
    console.log("❌ 前端可能有问题:");
    console.log("   1. 前端参数错误");
    console.log("   2. 前端没有等待交易确认");
    console.log("   3. 前端状态没有刷新");
    console.log("   4. 前端与合约ABI不匹配");

    console.log("\n如果测试中也失败:");
    console.log("❌ 合约逻辑有问题");
    console.log("   需要检查合约代码");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});