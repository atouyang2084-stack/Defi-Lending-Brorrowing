const {ethers} = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("正在使用账户部署合约:", deployer.address);

    // 1) 部署 Mock 代币
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
    const wbtc = await MockERC20.deploy("Mock WBTC", "WBTC", 8);

    // 等部署完成（v6 推荐都等一下，避免后面取地址/调用时报错）
    await usdc.waitForDeployment();
    await wbtc.waitForDeployment();

    // 2) 部署预言机
    const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
    const usdcOracle = await MockOracle.deploy(8, ethers.parseUnits("1", 8)); // $1
    const wbtcOracle = await MockOracle.deploy(8, ethers.parseUnits("60000", 8)); // $60000
    await usdcOracle.waitForDeployment();
    await wbtcOracle.waitForDeployment();

    // 3) 部署 LendingPool
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = await LendingPool.deploy();
    await pool.waitForDeployment();

    const poolAddr = await pool.getAddress();
    console.log("LendingPool 部署成功，地址:", poolAddr);

    // 4) 配置参数
    const kinkParams = {
        baseRatePerYearRay: ethers.parseUnits("0", 27),
        slope1PerYearRay: ethers.parseUnits("0.04", 27),
        slope2PerYearRay: ethers.parseUnits("1", 27),
        kinkWad: ethers.parseUnits("0.8", 18),
        blocksPerYear: 2628000,
    };

    await pool.configureAsset(
        {
            asset: await usdc.getAddress(),
            priceFeed: await usdcOracle.getAddress(),
            decimals: 6,
            ltvBps: 8000,
            liquidationThresholdBps: 8500,
            liquidationBonusBps: 500,
            reserveFactorBps: 1000,
            isActive: true,
        },
        kinkParams
    );

    await pool.configureAsset(
        {
            asset: await wbtc.getAddress(),
            priceFeed: await wbtcOracle.getAddress(),
            decimals: 8,
            ltvBps: 7500,
            liquidationThresholdBps: 8000,
            liquidationBonusBps: 1000,
            reserveFactorBps: 1000,
            isActive: true,
        },
        kinkParams
    );

    console.log("资产配置完成！");
    // 6) 给每一个本地账号发 USDC / WBTC
    const signers = await ethers.getSigners();

    const usdcPerAccount = ethers.parseUnits("100000", 6); // 每个账号 10万 USDC
    const wbtcPerAccount = ethers.parseUnits("1", 8);      // 每个账号 1 WBTC

    for (let i = 0; i < signers.length; i++) {
        const s = signers[i];

        await (await usdc.mint(s.address, usdcPerAccount)).wait();
        await (await wbtc.mint(s.address, wbtcPerAccount)).wait();

        // 可选：打印确认
        // console.log(
        //   `account[${i}] ${s.address} -> USDC ${await usdc.balanceOf(s.address)} , WBTC ${await wbtc.balanceOf(s.address)}`
        // );
    }

    console.log(`已给 ${signers.length} 个账号发币：每个 ${ethers.formatUnits(usdcPerAccount, 6)} USDC + ${ethers.formatUnits(wbtcPerAccount, 8)} WBTC`);

    // 5) 保存地址
    const addresses = {
        LendingPool: poolAddr,
        USDC: await usdc.getAddress(),
        WBTC: await wbtc.getAddress(),
        USDCOracle: await usdcOracle.getAddress(),
        WBTCOracle: await wbtcOracle.getAddress(),
    };

    fs.writeFileSync("contract-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("合约地址已保存到 contract-addresses.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
