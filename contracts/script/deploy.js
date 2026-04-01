const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("正在使用账户部署合约:", deployer.address);

  // 1. 部署 Mock 代币和预言机
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
  const wbtc = await MockERC20.deploy("Mock WBTC", "WBTC", 8);

  const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
  const usdcOracle = await MockOracle.deploy(8, ethers.utils.parseUnits("1", 8)); // $1
  const wbtcOracle = await MockOracle.deploy(8, ethers.utils.parseUnits("60000", 8)); // $60000

  // 2. 部署核心 LendingPool
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const pool = await LendingPool.deploy();
  await pool.deployed();

  console.log("LendingPool 部署成功，地址:", pool.address);

  // 3. 配置资产参数 (和测试脚本里的参数保持一致)
  const kinkParams = {
    baseRatePerYearRay: ethers.utils.parseUnits("0", 27),
    slope1PerYearRay: ethers.utils.parseUnits("0.04", 27),
    slope2PerYearRay: ethers.utils.parseUnits("1", 27),
    kinkWad: ethers.utils.parseUnits("0.8", 18),
    blocksPerYear: 2628000
  };

  await pool.configureAsset({
    asset: usdc.address, priceFeed: usdcOracle.address, decimals: 6,
    ltvBps: 8000, liquidationThresholdBps: 8500, liquidationBonusBps: 500, reserveFactorBps: 1000, isActive: true
  }, kinkParams);

  await pool.configureAsset({
    asset: wbtc.address, priceFeed: wbtcOracle.address, decimals: 8,
    ltvBps: 7500, liquidationThresholdBps: 8000, liquidationBonusBps: 1000, reserveFactorBps: 1000, isActive: true
  }, kinkParams);

  console.log("资产配置完成！");

  // 4. 【大招】把地址保存成 JSON，方便前端读取
  const addresses = {
    LendingPool: pool.address,
    USDC: usdc.address,
    WBTC: wbtc.address,
    USDCOracle: usdcOracle.address,
    WBTCOracle: wbtcOracle.address
  };

  fs.writeFileSync("contract-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("合约地址已保存到 contract-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});