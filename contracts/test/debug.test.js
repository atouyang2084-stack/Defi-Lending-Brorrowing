const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Debug Test", function () {
  let owner, user1;
  let pool, usdc, usdcOracle;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    console.log("1. Deploying MockERC20...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await usdc.waitForDeployment();
    console.log("   USDC deployed at:", await usdc.getAddress());

    console.log("2. Deploying MockOracle...");
    const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
    usdcOracle = await MockOracle.deploy(8, ethers.parseUnits("1", 8));
    await usdcOracle.waitForDeployment();
    console.log("   Oracle deployed at:", await usdcOracle.getAddress());

    console.log("3. Deploying LendingPool...");
    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy();
    await pool.waitForDeployment();
    console.log("   LendingPool deployed at:", await pool.getAddress());

    console.log("4. Configuring asset...");
    const kinkParams = {
      baseRatePerYearRay: ethers.parseUnits("0", 27),
      slope1PerYearRay: ethers.parseUnits("0.04", 27),
      slope2PerYearRay: ethers.parseUnits("1", 27),
      kinkWad: ethers.parseUnits("0.8", 18),
      blocksPerYear: 2628000
    };

    const assetConfig = {
      asset: await usdc.getAddress(),
      priceFeed: await usdcOracle.getAddress(),
      decimals: 6,
      ltvBps: 8000,
      liquidationThresholdBps: 8500,
      liquidationBonusBps: 500,
      reserveFactorBps: 1000,
      isActive: true
    };

    console.log("   Asset config:", assetConfig);
    console.log("   Kink params:", kinkParams);

    try {
      const tx = await pool.configureAsset(assetConfig, kinkParams);
      console.log("   ConfigureAsset tx sent:", tx.hash);
      await tx.wait();
      console.log("   ConfigureAsset successful");
    } catch (error) {
      console.error("   ConfigureAsset error:", error.message);
      throw error;
    }
  });

  it("Should work", async function () {
    console.log("Test passed!");
    expect(true).to.be.true;
  });
});