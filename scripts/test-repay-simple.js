const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试还款功能");
    console.log("================\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("测试用户:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("USDC地址:", await usdc.getAddress());
    console.log("LendingPool地址:", await pool.getAddress());

    // 1. 检查用户USDC余额
    const userUsdcBalance = await usdc.balanceOf(user.address);
    console.log(`用户USDC余额: ${ethers.formatUnits(userUsdcBalance, 6)} USDC`);

    // 2. 检查用户借款余额
    const userBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    console.log(`用户借款余额: ${ethers.formatUnits(userBorrowBalance, 6)} USDC`);

    // 3. 如果没有借款，先创建借款
    if (userBorrowBalance === 0n) {
        console.log("\n用户没有借款，先创建借款...");

        // 先存款提供流动性
        console.log("1. 先存款提供流动性...");
        const depositAmount = ethers.parseUnits("1000", 6);
        await usdc.connect(deployer).approve(await pool.getAddress(), depositAmount);
        await pool.connect(deployer).deposit({
            asset: await usdc.getAddress(),
            amount: depositAmount,
            onBehalfOf: deployer.address
        });
        console.log("✅ 存款成功");

        // 用户抵押WBTC
        console.log("2. 用户抵押WBTC...");
        const wbtc = MockERC20.attach(addresses.WBTC);
        const wbtcAmount = ethers.parseUnits("0.1", 8);
        await wbtc.connect(user).approve(await pool.getAddress(), wbtcAmount);
        await pool.connect(user).deposit({
            asset: await wbtc.getAddress(),
            amount: wbtcAmount,
            onBehalfOf: user.address
        });
        console.log("✅ WBTC抵押成功");

        // 用户借款
        console.log("3. 用户借款...");
        const borrowAmount = ethers.parseUnits("100", 6);
        await pool.connect(user).borrow({
            asset: await usdc.getAddress(),
            amount: borrowAmount,
            onBehalfOf: user.address
        });
        console.log("✅ 借款成功");

        // 检查借款后余额
        const newBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
        console.log(`借款后余额: ${ethers.formatUnits(newBorrowBalance, 6)} USDC`);
    }

    // 4. 检查用户对pool的授权
    const allowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log(`\n用户授权额度: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 5. 检查用户USDC余额是否足够还款
    const currentBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
    const currentUsdcBalance = await usdc.balanceOf(user.address);

    console.log(`当前借款余额: ${ethers.formatUnits(currentBorrowBalance, 6)} USDC`);
    console.log(`当前USDC余额: ${ethers.formatUnits(currentUsdcBalance, 6)} USDC`);

    if (currentUsdcBalance < currentBorrowBalance) {
        console.log(`⚠️ 用户USDC余额不足，需要补充...`);
        const needed = currentBorrowBalance - currentUsdcBalance;
        await usdc.connect(deployer).transfer(user.address, needed);
        console.log(`✅ 已补充 ${ethers.formatUnits(needed, 6)} USDC`);
    }

    // 6. 如果需要，先授权
    if (allowance < currentBorrowBalance) {
        console.log(`授权 ${ethers.formatUnits(currentBorrowBalance, 6)} USDC给LendingPool...`);
        const approveTx = await usdc.connect(user).approve(await pool.getAddress(), currentBorrowBalance);
        await approveTx.wait();
        console.log("✅ 授权成功");
    }

    // 7. 尝试还款
    const repayAmount = ethers.parseUnits("50", 6); // 还50 USDC
    console.log(`\n尝试还款: ${ethers.formatUnits(repayAmount, 6)} USDC`);

    try {
        console.log("调用repay函数...");
        console.log("参数:", {
            asset: await usdc.getAddress(),
            amount: repayAmount.toString(),
            onBehalfOf: user.address
        });

        const repayTx = await pool.connect(user).repay({
            asset: await usdc.getAddress(),
            amount: repayAmount,
            onBehalfOf: user.address
        });

        console.log("交易已发送，等待确认...");
        const receipt = await repayTx.wait();
        console.log("✅ 还款成功！");
        console.log("交易哈希:", receipt.hash);
        console.log("区块号:", receipt.blockNumber);

        // 检查还款后的余额
        const afterBorrowBalance = await pool.userBorrowBalance(user.address, await usdc.getAddress());
        console.log(`还款后借款余额: ${ethers.formatUnits(afterBorrowBalance, 6)} USDC`);

    } catch (error) {
        console.log("❌ 还款失败:", error.message);

        // 尝试获取更详细的错误信息
        if (error.data) {
            console.log("错误数据:", error.data);
        }

        if (error.reason) {
            console.log("错误原因:", error.reason);
        }

        // 检查合约状态
        console.log("\n检查合约状态:");
        try {
            const reserveData = await pool.getReserveData(await usdc.getAddress());
            console.log("Reserve Data:", {
                totalSupplyScaled: reserveData.totalSupplyScaled.toString(),
                totalBorrowScaled: reserveData.totalBorrowScaled.toString(),
                borrowIndex: reserveData.borrowIndex.toString(),
                protocolReserves: reserveData.protocolReserves.toString()
            });

            // 检查用户账户数据
            const accountData = await pool.userAccountData(user.address);
            console.log("User Account Data:", {
                collateralValueUsdWad: accountData.collateralValueUsdWad.toString(),
                debtValueUsdWad: accountData.debtValueUsdWad.toString(),
                weightedCollateralForHFUsdWad: accountData.weightedCollateralForHFUsdWad.toString()
            });

        } catch (e) {
            console.log("检查状态时出错:", e.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});