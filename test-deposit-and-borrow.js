const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer, user] = await ethers.getSigners();
    console.log("使用账户:", user.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 加载合约
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = LendingPool.attach(addresses.LendingPool);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);

    // 1. 先批准USDC
    console.log("\n=== 1. 批准USDC ===");
    const approveAmount = ethers.parseUnits("10000", 6); // 10000 USDC
    const approveTx = await usdc.connect(user).approve(addresses.LendingPool, approveAmount);
    await approveTx.wait();
    console.log("USDC批准完成");

    // 2. 存入1000 USDC作为抵押品
    console.log("\n=== 2. 存入1000 USDC ===");
    const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC
    const depositTx = await pool.connect(user).deposit({
        asset: addresses.USDC,
        amount: depositAmount,
        onBehalfOf: user.address
    });
    await depositTx.wait();
    console.log("存入1000 USDC完成");

    // 3. 检查存款后的状态
    console.log("\n=== 3. 检查存款后状态 ===");

    // 检查用户账户数据
    const accountData = await pool.userAccountData(user.address);
    const collateralValue = ethers.formatUnits(accountData[0], 18);
    const debtValue = ethers.formatUnits(accountData[1], 18);
    const healthFactor = ethers.formatUnits(accountData[3], 27);

    console.log("抵押品价值: $", collateralValue);
    console.log("债务价值: $", debtValue);
    console.log("健康因子:", healthFactor);

    // 检查USDC配置
    const usdcConfig = await pool.getAssetConfig(addresses.USDC);
    console.log("USDC LTV:", usdcConfig.ltvBps.toString(), "bps");

    // 计算最大可借款
    const ltvBps = BigInt(usdcConfig.ltvBps.toString());
    const collateralValueBigInt = BigInt(accountData[0].toString());
    const debtValueBigInt = BigInt(accountData[1].toString());
    const maxBorrowUsd = (collateralValueBigInt * ltvBps) / 10000n - debtValueBigInt;

    // 转换为USDC数量
    const decimals = Number(usdcConfig.decimals);
    const decimalsDiff = 18 - decimals;
    const maxBorrowTokens = maxBorrowUsd > 0n ? maxBorrowUsd / (10n ** BigInt(decimalsDiff)) : 0n;

    console.log("最大可借款 (USDC):", maxBorrowTokens.toString());
    console.log("最大可借款 (USD): $", ethers.formatUnits(maxBorrowUsd, 18));

    // 检查USDC储备数据
    const reserveData = await pool.getReserveData(addresses.USDC);
    const availableLiquidity = reserveData.totalSupplyScaled - reserveData.totalBorrowScaled - reserveData.protocolReserves;
    console.log("可用流动性 (USDC):", availableLiquidity.toString());

    // 4. 尝试借款（如果可能）
    if (maxBorrowTokens > 0n && availableLiquidity > 0n) {
        console.log("\n=== 4. 尝试借款 ===");
        const borrowAmount = maxBorrowTokens > 1000000n ? 1000000n : maxBorrowTokens; // 最多借1 USDC或最大可借款
        console.log("借款金额:", borrowAmount.toString(), "USDC");

        try {
            const borrowTx = await pool.connect(user).borrow({
                asset: addresses.USDC,
                amount: borrowAmount,
                onBehalfOf: user.address
            });
            await borrowTx.wait();
            console.log("借款成功!");

            // 检查借款后状态
            const accountDataAfter = await pool.userAccountData(user.address);
            console.log("借款后债务价值: $", ethers.formatUnits(accountDataAfter[1], 18));
            console.log("借款后健康因子:", ethers.formatUnits(accountDataAfter[3], 27));
        } catch (error) {
            console.error("借款失败:", error.message);
        }
    } else {
        console.log("\n=== 4. 无法借款 ===");
        console.log("原因: 最大可借款 =", maxBorrowTokens.toString(), "可用流动性 =", availableLiquidity.toString());
    }

    // 5. 最终状态
    console.log("\n=== 5. 最终状态 ===");
    const finalAccountData = await pool.userAccountData(user.address);
    console.log("最终抵押品价值: $", ethers.formatUnits(finalAccountData[0], 18));
    console.log("最终债务价值: $", ethers.formatUnits(finalAccountData[1], 18));
    console.log("最终健康因子:", ethers.formatUnits(finalAccountData[3], 27));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});