const { ethers } = require("hardhat");

async function main() {
    const [deployer, user] = await ethers.getSigners();
    console.log("测试账户:", user.address);

    // 加载合约
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const pool = await LendingPool.attach("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9");

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");

    // 检查用户USDC余额
    const balanceBefore = await usdc.balanceOf(user.address);
    console.log("用户USDC余额:", ethers.formatUnits(balanceBefore, 6), "USDC");

    // 检查授权
    const allowance = await usdc.allowance(user.address, pool.target);
    console.log("授权额度:", ethers.formatUnits(allowance, 6), "USDC");

    // 如果需要，先授权
    if (allowance < ethers.parseUnits("100", 6)) {
        console.log("授权中...");
        const tx = await usdc.connect(user).approve(pool.target, ethers.MaxUint256);
        await tx.wait();
        console.log("授权完成");
    }

    // 存款测试
    console.log("\n存款测试...");
    const depositAmount = ethers.parseUnits("100", 6);

    // 检查用户存款余额
    const suppliedBefore = await pool.userSupplyBalance(user.address, usdc.target);
    console.log("存款前用户存款余额:", ethers.formatUnits(suppliedBefore, 6), "USDC");

    // 执行存款
    console.log("执行存款:", ethers.formatUnits(depositAmount, 6), "USDC");
    const tx = await pool.connect(user).deposit({
        asset: usdc.target,
        amount: depositAmount,
        onBehalfOf: user.address
    });

    const receipt = await tx.wait();
    console.log("存款交易哈希:", receipt.hash);

    // 检查存款后余额
    const suppliedAfter = await pool.userSupplyBalance(user.address, usdc.target);
    console.log("存款后用户存款余额:", ethers.formatUnits(suppliedAfter, 6), "USDC");

    const balanceAfter = await usdc.balanceOf(user.address);
    console.log("存款后用户USDC余额:", ethers.formatUnits(balanceAfter, 6), "USDC");

    console.log("\n存款增加:", ethers.formatUnits(suppliedAfter - suppliedBefore, 6), "USDC");
    console.log("余额减少:", ethers.formatUnits(balanceBefore - balanceAfter, 6), "USDC");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});