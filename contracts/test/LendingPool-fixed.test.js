const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool 核心功能与清算测试 (Fixed)", function () {
  let owner, user1, user2, user3;
  let pool, usdc, wbtc, usdcOracle, wbtcOracle;

  beforeEach(async function () {
    // user1: 存款人(USDC), user2: 借款人(存WBTC借USDC), user3: 清算人
    [owner, user1, user2, user3] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
    wbtc = await MockERC20.deploy("Mock WBTC", "WBTC", 8);
    await usdc.waitForDeployment();
    await wbtc.waitForDeployment();

    const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
    usdcOracle = await MockOracle.deploy(8, ethers.parseUnits("1", 8)); // USDC = $1
    wbtcOracle = await MockOracle.deploy(8, ethers.parseUnits("60000", 8)); // WBTC = $60000
    await usdcOracle.waitForDeployment();
    await wbtcOracle.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy();
    await pool.waitForDeployment();

    // 给用户发测试币
    await usdc.mint(user1.address, ethers.parseUnits("100000", 6)); // user1 有 100000 USDC
    await wbtc.mint(user2.address, ethers.parseUnits("1", 8));     // user2 有 1 WBTC
    await usdc.mint(user3.address, ethers.parseUnits("10000", 6)); // user3 有 10000 USDC 用来清算

    const kinkParams = {
      baseRatePerYearRay: ethers.parseUnits("0", 27),
      slope1PerYearRay: ethers.parseUnits("0.04", 27),
      slope2PerYearRay: ethers.parseUnits("1", 27),
      kinkWad: ethers.parseUnits("0.8", 18),
      blocksPerYear: 2628000
    };

    // 配置 USDC (作为借出资产)
    await pool.configureAsset({
      asset: await usdc.getAddress(),
      priceFeed: await usdcOracle.getAddress(),
      decimals: 6,
      ltvBps: 8000,
      liquidationThresholdBps: 8500,
      liquidationBonusBps: 500,
      reserveFactorBps: 1000,
      isActive: true
    }, kinkParams);

    // 配置 WBTC (作为抵押资产，LTV 75%，清算线 80%，清算奖励 10%)
    await pool.configureAsset({
      asset: await wbtc.getAddress(),
      priceFeed: await wbtcOracle.getAddress(),
      decimals: 8,
      ltvBps: 7500,
      liquidationThresholdBps: 8000,
      liquidationBonusBps: 1000,
      reserveFactorBps: 1000,
      isActive: true
    }, kinkParams);
  });

  it("1. 应该允许用户成功存入 USDC", async function () {
    const depositAmount = ethers.parseUnits("100", 6);
    const usdcAddress = await usdc.getAddress();
    const poolAddress = await pool.getAddress();

    await usdc.connect(user1).approve(poolAddress, depositAmount);
    await pool.connect(user1).deposit({ asset: usdcAddress, amount: depositAmount, onBehalfOf: ethers.ZeroAddress });

    const balance = await pool.userSupplyBalance(user1.address, usdcAddress);
    expect(balance.toString()).to.equal(depositAmount.toString());
  });

  it("2. 应该允许用户抵押 WBTC 并借出 USDC", async function () {
    const usdcAddress = await usdc.getAddress();
    const wbtcAddress = await wbtc.getAddress();
    const poolAddress = await pool.getAddress();

    // 第一步：user1 存入 100,000 USDC 作为池子流动性 (金额加大，让 user2 够借)
    await usdc.connect(user1).approve(poolAddress, ethers.parseUnits("100000", 6));
    await pool.connect(user1).deposit({ asset: usdcAddress, amount: ethers.parseUnits("100000", 6), onBehalfOf: ethers.ZeroAddress });

    // 第二步：user2 存入 1 WBTC 作为抵押品 (价值 $60,000)
    await wbtc.connect(user2).approve(poolAddress, ethers.parseUnits("1", 8));
    await pool.connect(user2).deposit({ asset: wbtcAddress, amount: ethers.parseUnits("1", 8), onBehalfOf: ethers.ZeroAddress });

    // 第三步：user2 借出 20000 USDC
    const borrowAmount = ethers.parseUnits("20000", 6);
    await pool.connect(user2).borrow({ asset: usdcAddress, amount: borrowAmount, onBehalfOf: ethers.ZeroAddress });

    // 验证：user2 的钱包里是否多出了 20000 USDC
    const user2UsdcBalance = await usdc.balanceOf(user2.address);
    expect(user2UsdcBalance.toString()).to.equal(borrowAmount.toString());

    // 验证：健康因子 (HF) 应该大于 1 (RAY 精度, 即 > 1e27)
    const hf = await pool.healthFactor(user2.address);
    expect(hf > ethers.parseUnits("1", 27)).to.be.true;
  });

  it("3. 当价格暴跌导致健康因子跌破 1 时，允许第三方清算", async function () {
    const usdcAddress = await usdc.getAddress();
    const wbtcAddress = await wbtc.getAddress();
    const poolAddress = await pool.getAddress();
    const wbtcOracleAddress = await wbtcOracle.getAddress();

    // 准备工作：建仓 (金额加大，让 user2 够借)
    await usdc.connect(user1).approve(poolAddress, ethers.parseUnits("100000", 6));
    await pool.connect(user1).deposit({ asset: usdcAddress, amount: ethers.parseUnits("100000", 6), onBehalfOf: ethers.ZeroAddress });
    await wbtc.connect(user2).approve(poolAddress, ethers.parseUnits("1", 8));
    await pool.connect(user2).deposit({ asset: wbtcAddress, amount: ethers.parseUnits("1", 8), onBehalfOf: ethers.ZeroAddress });
    await pool.connect(user2).borrow({ asset: usdcAddress, amount: ethers.parseUnits("40000", 6), onBehalfOf: ethers.ZeroAddress });

    // 核心操作：模拟市场大跌！WBTC 价格从 $60,000 暴跌到 $45,000
    await wbtcOracle.updateAnswer(ethers.parseUnits("45000", 8));

    // 此时 user2 的健康因子应该跌破 1 ( < 1e27)
    const hfBefore = await pool.healthFactor(user2.address);
    expect(hfBefore < ethers.parseUnits("1", 27)).to.be.true;

    // 清算人 user3 介入，替 user2 偿还 10000 USDC 债务
    const repayAmount = ethers.parseUnits("10000", 6);
    await usdc.connect(user3).approve(poolAddress, repayAmount);

    // 记录清算前 user3 的 WBTC 余额
    const wbtcBalanceBefore = await wbtc.balanceOf(user3.address);

    // 执行清算
    await pool.connect(user3).liquidate(
      user2.address,      // 借款人
      usdcAddress,       // 债务资产
      wbtcAddress,       // 抵押资产
      repayAmount,        // 帮还金额
      0                   // 最小接收抵押品数量（这里为简便设为 0）
    );

    // 验证：user3 应该获得了清算奖励 (WBTC 余额增加)
    const wbtcBalanceAfter = await wbtc.balanceOf(user3.address);
    expect(wbtcBalanceAfter > wbtcBalanceBefore).to.be.true;
    console.log(`✅ 清算成功！清算人获利抵押品数量: ${ethers.formatUnits(wbtcBalanceAfter - wbtcBalanceBefore, 8)} WBTC`);
  });

  it("4. 应该允许用户成功执行闪电贷 (Flash Loan) 并支付手续费", async function () {
    const usdcAddress = await usdc.getAddress();
    const poolAddress = await pool.getAddress();

    // 1. 先给池子注入 100,000 USDC 的流动性，不然没钱可借
    await usdc.connect(user1).approve(poolAddress, ethers.parseUnits("100000", 6));
    await pool.connect(user1).deposit({ asset: usdcAddress, amount: ethers.parseUnits("100000", 6), onBehalfOf: ethers.ZeroAddress });

    // 2. 部署我们刚才写的那个"借款人"合约
    const MockFlashLoanReceiver = await ethers.getContractFactory("MockFlashLoanReceiver");
    const receiver = await MockFlashLoanReceiver.deploy(poolAddress);
    await receiver.waitForDeployment();

    // 3. 重点：借款人还钱时需要多还 0.09% 的手续费。
    // 我们打算闪电贷借 10,000 USDC，手续费就是 9 USDC。
    // 所以我们提前给接收合约发 10 个 USDC 当本钱，防止它没钱付手续费被回滚。
    const flashAmount = ethers.parseUnits("10000", 6);
    await usdc.mint(await receiver.getAddress(), ethers.parseUnits("10", 6));

    // 4. 记录闪电贷执行前，池子赚取的协议收入 (Protocol Reserves)
    const reserveDataBefore = await pool.getReserveData(usdcAddress);

    // 5. 见证奇迹的时刻：发起闪电贷！
    await pool.connect(user1).flashLoan({
      receiver: await receiver.getAddress(),
      asset: usdcAddress,
      amount: flashAmount,
      data: "0x" // 我们不需要传额外数据
    });

    // 6. 验证结果：池子的协议收入应该增加了 9 个 USDC
    const reserveDataAfter = await pool.getReserveData(usdcAddress);
    const feeEarned = reserveDataAfter.protocolReserves - reserveDataBefore.protocolReserves;

    expect(feeEarned.toString()).to.equal(ethers.parseUnits("9", 6).toString());
    console.log(`✅ 闪电贷执行成功！池子白赚了手续费: ${ethers.formatUnits(feeEarned, 6)} USDC`);
  });
});