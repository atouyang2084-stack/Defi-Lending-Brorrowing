const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test Deposit", function () {
  it("Should deposit USDC", async function () {
    const [owner, user1] = await ethers.getSigners();

    // Deploy contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await usdc.waitForDeployment();

    const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
    const usdcOracle = await MockOracle.deploy(8, ethers.parseUnits("1", 8));
    await usdcOracle.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = await LendingPool.deploy();
    await pool.waitForDeployment();

    // Get addresses
    const usdcAddress = await usdc.getAddress();
    const poolAddress = await pool.getAddress();
    const oracleAddress = await usdcOracle.getAddress();

    // Configure asset
    const kinkParams = {
      baseRatePerYearRay: ethers.parseUnits("0", 27),
      slope1PerYearRay: ethers.parseUnits("0.04", 27),
      slope2PerYearRay: ethers.parseUnits("1", 27),
      kinkWad: ethers.parseUnits("0.8", 18),
      blocksPerYear: 2628000
    };

    await pool.configureAsset({
      asset: usdcAddress,
      priceFeed: oracleAddress,
      decimals: 6,
      ltvBps: 8000,
      liquidationThresholdBps: 8500,
      liquidationBonusBps: 500,
      reserveFactorBps: 1000,
      isActive: true
    }, kinkParams);

    // Mint tokens to user1
    await usdc.mint(user1.address, ethers.parseUnits("1000", 6));

    // Approve and deposit
    const depositAmount = ethers.parseUnits("100", 6);
    await usdc.connect(user1).approve(poolAddress, depositAmount);

    // Try to deposit
    console.log("Attempting deposit...");
    console.log("User:", user1.address);
    console.log("USDC:", usdcAddress);
    console.log("Pool:", poolAddress);
    console.log("Amount:", depositAmount.toString());

    try {
      const tx = await pool.connect(user1).deposit({
        asset: usdcAddress,
        amount: depositAmount,
        onBehalfOf: ethers.ZeroAddress
      });
      await tx.wait();
      console.log("Deposit successful!");

      // Check balance
      const balance = await pool.userSupplyBalance(user1.address, usdcAddress);
      console.log("User supply balance:", balance.toString());
      expect(balance.toString()).to.equal(depositAmount.toString());
    } catch (error) {
      console.error("Deposit error:", error.message);
      throw error;
    }
  });
});