const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("正在使用账户部署修复版合约:", deployer.address);

    // 1) 部署 Mock 代币
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
    const wbtc = await MockERC20.deploy("Mock WBTC", "WBTC", 8);

    await usdc.waitForDeployment();
    await wbtc.waitForDeployment();

    // 2) 部署预言机 - 设置WBTC为低价$5,000确保可清算
    const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
    const usdcOracle = await MockOracle.deploy(8, ethers.parseUnits("1", 8)); // $1
    const wbtcOracle = await MockOracle.deploy(8, ethers.parseUnits("5000", 8)); // $5,000 低价！
    await usdcOracle.waitForDeployment();
    await wbtcOracle.waitForDeployment();

    // 3) 部署 LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = await LendingPool.deploy();
    await pool.waitForDeployment();

    const poolAddr = await pool.getAddress();
    console.log("LendingPool 部署成功，地址:", poolAddr);

    // 4) 配置参数 - 设置更宽松的参数便于测试
    const kinkParams = {
        baseRatePerYearRay: ethers.parseUnits("0", 27),
        slope1PerYearRay: ethers.parseUnits("0.04", 27),
        slope2PerYearRay: ethers.parseUnits("1", 27),
        kinkWad: ethers.parseUnits("0.8", 18),
        blocksPerYear: 2628000,
    };

    // USDC配置
    await pool.configureAsset(
        {
            asset: await usdc.getAddress(),
            priceFeed: await usdcOracle.getAddress(),
            decimals: 6,
            ltvBps: 8000, // 80%
            liquidationThresholdBps: 8500, // 85%
            liquidationBonusBps: 500, // 5%
            reserveFactorBps: 1000, // 10%
            isActive: true,
        },
        kinkParams
    );

    // WBTC配置 - 设置低LTV和阈值确保容易清算
    await pool.configureAsset(
        {
            asset: await wbtc.getAddress(),
            priceFeed: await wbtcOracle.getAddress(),
            decimals: 8,
            ltvBps: 5000, // 50% 低LTV
            liquidationThresholdBps: 6000, // 60% 低阈值
            liquidationBonusBps: 1000, // 10%
            reserveFactorBps: 1000, // 10%
            isActive: true,
        },
        kinkParams
    );

    console.log("资产配置完成！");

    // 5) 给每一个本地账号发 USDC / WBTC
    const signers = await ethers.getSigners();

    const usdcPerAccount = ethers.parseUnits("100000", 6); // 每个账号 10万 USDC
    const wbtcPerAccount = ethers.parseUnits("1", 8);      // 每个账号 1 WBTC

    for (let i = 0; i < signers.length; i++) {
        const s = signers[i];
        await (await usdc.mint(s.address, usdcPerAccount)).wait();
        await (await wbtc.mint(s.address, wbtcPerAccount)).wait();
    }

    console.log(`已给 ${signers.length} 个账号发币：每个 ${ethers.formatUnits(usdcPerAccount, 6)} USDC + ${ethers.formatUnits(wbtcPerAccount, 8)} WBTC`);

    // 6) 保存地址
    const addresses = {
        LendingPool: poolAddr,
        USDC: await usdc.getAddress(),
        WBTC: await wbtc.getAddress(),
        USDCOracle: await usdcOracle.getAddress(),
        WBTCOracle: await wbtcOracle.getAddress(),
    };

    fs.writeFileSync("contract-addresses-fixed.json", JSON.stringify(addresses, null, 2));
    console.log("合约地址已保存到 contract-addresses-fixed.json");

    console.log("\n=== 部署完成 ===");
    console.log("\n测试参数优化：");
    console.log("1. WBTC价格: $5,000 (确保低价)");
    console.log("2. WBTC LTV: 50% (低)");
    console.log("3. WBTC清算阈值: 60% (低)");
    console.log("4. 更容易触发清算条件");

    console.log("\n测试步骤：");
    console.log("1. 借款人存款0.5 WBTC ($2,500价值)");
    console.log("2. 借款人借款2,000 USDC");
    console.log("3. 健康因子应该 < 1 (60% of $2,500 = $1,500 < $2,000)");
    console.log("4. 直接可以清算！");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});