const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 测试你的地址存款功能");
    console.log("=======================\n");

    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";
    console.log("你的地址:", yourAddress);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("USDC地址:", await usdc.getAddress());
    console.log("LendingPool地址:", await pool.getAddress());

    // 1. 检查你的USDC余额
    const yourUsdcBalance = await usdc.balanceOf(yourAddress);
    console.log(`你的USDC余额: ${ethers.formatUnits(yourUsdcBalance, 6)} USDC`);

    // 2. 检查你对pool的授权
    const allowance = await usdc.allowance(yourAddress, await pool.getAddress());
    console.log(`你的授权额度: ${ethers.formatUnits(allowance, 6)} USDC`);

    // 3. 模拟前端存款（使用部署者账户代为操作）
    const depositAmount = ethers.parseUnits("10", 6); // 10 USDC
    console.log(`\n尝试存款: ${ethers.formatUnits(depositAmount, 6)} USDC`);

    // 首先需要授权
    console.log("授权10 USDC给LendingPool...");
    const approveTx = await usdc.connect(deployer).approve(await pool.getAddress(), depositAmount);
    await approveTx.wait();
    console.log("✅ 授权成功");

    // 尝试存款
    try {
        const depositTx = await pool.connect(deployer).deposit({
            asset: await usdc.getAddress(),
            amount: depositAmount,
            onBehalfOf: yourAddress
        });
        await depositTx.wait();
        console.log("✅ 存款成功！");
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 尝试获取更详细的错误信息
        if (error.data) {
            console.log("错误数据:", error.data);
        }

        // 检查revert原因
        if (error.message.includes("reverted")) {
            console.log("\n尝试解析revert原因...");

            // 检查合约状态
            try {
                const reserveData = await pool.getReserveData(await usdc.getAddress());
                console.log("supplyIndex:", reserveData.supplyIndex.toString());
                console.log("RAY:", (await pool.RAY()).toString());

                // 计算 scaled 值
                const RAY = await pool.RAY();
                const scaled = (depositAmount * RAY) / reserveData.supplyIndex;
                console.log("计算出的scaled值:", scaled.toString());

                // 检查是否会导致溢出
                const userSupplyScaled = await pool.userSupplyScaled(yourAddress, await usdc.getAddress());
                console.log("你当前的userSupplyScaled:", userSupplyScaled.toString());

                if (userSupplyScaled > ethers.MaxUint256 - scaled) {
                    console.log("⚠️ 你的存款会导致溢出!");
                }

                const totalSupplyScaled = reserveData.totalSupplyScaled;
                console.log("当前totalSupplyScaled:", totalSupplyScaled.toString());

                if (totalSupplyScaled > ethers.MaxUint256 - scaled) {
                    console.log("⚠️ 总存款会导致溢出!");
                }

                // 检查supplyIndex是否为0
                if (reserveData.supplyIndex === 0n) {
                    console.log("⚠️ supplyIndex为0，这会导致除以0的错误！");
                }

                // 检查depositAmount是否太小
                if (scaled === 0n) {
                    console.log("⚠️ scaled值为0，可能是因为存款金额太小或supplyIndex太大");
                    console.log(`depositAmount: ${depositAmount}`);
                    console.log(`RAY: ${RAY}`);
                    console.log(`supplyIndex: ${reserveData.supplyIndex}`);
                }
            } catch (e) {
                console.log("检查状态时出错:", e.message);
            }
        }
    }

    // 4. 检查存款后的余额
    const newYourUsdcBalance = await usdc.balanceOf(yourAddress);
    const yourSupply = await pool.userSupplyBalance(yourAddress, await usdc.getAddress());

    console.log(`\n存款后状态:`);
    console.log(`你的USDC余额: ${ethers.formatUnits(newYourUsdcBalance, 6)} USDC`);
    console.log(`你在池中的存款: ${ethers.formatUnits(yourSupply, 6)} USDC`);

    // 5. 检查reserve数据
    console.log("\nReserve数据:");
    const reserveData = await pool.getReserveData(await usdc.getAddress());
    console.log("supplyIndex:", reserveData.supplyIndex.toString());
    console.log("totalSupplyScaled:", reserveData.totalSupplyScaled.toString());
    console.log("lastUpdatedBlock:", reserveData.lastUpdatedBlock.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});