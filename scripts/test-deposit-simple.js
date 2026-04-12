const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试存款功能");
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

    // 2. 检查用户对pool的授权
    const allowance = await usdc.allowance(user.address, await pool.getAddress());
    console.log(`用户授权额度: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 3. 如果需要，先授权
    if (allowance < ethers.parseUnits("100", 6)) {
        console.log("授权100 USDC给LendingPool...");
        const approveTx = await usdc.connect(user).approve(await pool.getAddress(), ethers.parseUnits("100", 6));
        await approveTx.wait();
        console.log("✅ 授权成功");
    }

    // 4. 尝试存款
    const depositAmount = ethers.parseUnits("10", 6); // 10 USDC
    console.log(`\n尝试存款: ${ethers.formatUnits(depositAmount, 6)} USDC`);

    try {
        const depositTx = await pool.connect(user).deposit({
            asset: await usdc.getAddress(),
            amount: depositAmount,
            onBehalfOf: user.address
        });
        await depositTx.wait();
        console.log("✅ 存款成功！");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 尝试获取更详细的错误信息
        if (error.data) {
            console.log("错误数据:", error.data);
        }

        // 检查合约状态
        console.log("\n检查合约状态:");
        try {
            const reserveData = await pool.getReserveData(await usdc.getAddress());
            console.log("supplyIndex:", reserveData.supplyIndex.toString());
            console.log("RAY:", (await pool.RAY()).toString());

            // 计算 scaled 值
            const scaled = (depositAmount * (await pool.RAY())) / reserveData.supplyIndex;
            console.log("计算出的scaled值:", scaled.toString());

            // 检查是否会导致溢出
            const userSupplyScaled = await pool.userSupplyScaled(user.address, await usdc.getAddress());
            console.log("用户当前的userSupplyScaled:", userSupplyScaled.toString());

            if (userSupplyScaled > ethers.MaxUint256 - scaled) {
                console.log("⚠️ 用户存款会导致溢出!");
            }

            const totalSupplyScaled = reserveData.totalSupplyScaled;
            console.log("当前totalSupplyScaled:", totalSupplyScaled.toString());

            if (totalSupplyScaled > ethers.MaxUint256 - scaled) {
                console.log("⚠️ 总存款会导致溢出!");
            }
        } catch (e) {
            console.log("检查状态时出错:", e.message);
        }
    }

    // 5. 检查存款后的余额
    const newUserUsdcBalance = await usdc.balanceOf(user.address);
    const userSupply = await pool.userSupplyBalance(user.address, await usdc.getAddress());

    console.log(`\n存款后状态:`);
    console.log(`用户USDC余额: ${ethers.formatUnits(newUserUsdcBalance, 6)} USDC`);
    console.log(`用户在池中的存款: ${ethers.formatUnits(userSupply, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});