const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🚀 给任意账户铸造测试代币");
    console.log("=========================\n");

    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);
    const wbtc = MockERC20.attach(addresses.WBTC);

    // 通过环境变量获取地址
    const targetAddress = process.env.TARGET_ADDRESS;

    if (!targetAddress || targetAddress.length !== 42 || !targetAddress.startsWith("0x")) {
        console.log("❌ 请通过环境变量设置目标地址");
        console.log("用法: TARGET_ADDRESS=0x你的地址 npx hardhat run scripts/mint-to-any-account.js --network localhost");
        console.log("示例: TARGET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e90F1b6c1a3 npx hardhat run scripts/mint-to-any-account.js --network localhost");
        console.log("\n或者编辑此文件，在第20行直接设置地址");
        return;
    }

    console.log("目标账户:", targetAddress);
    console.log("");

    // 1. 发送ETH作为Gas
    console.log("1. 发送ETH...");
    const ethAmount = ethers.parseEther("10");
    const ethTx = await deployer.sendTransaction({
        to: targetAddress,
        value: ethAmount
    });
    await ethTx.wait();
    console.log(`   ✅ 发送 ${ethers.formatEther(ethAmount)} ETH 完成`);

    // 2. 铸造USDC
    console.log("2. 铸造USDC...");
    const usdcAmount = ethers.parseUnits("100000", 6);
    const usdcTx = await usdc.mint(targetAddress, usdcAmount);
    await usdcTx.wait();
    console.log(`   ✅ 铸造 ${ethers.formatUnits(usdcAmount, 6)} USDC 完成`);

    // 3. 铸造WBTC
    console.log("3. 铸造WBTC...");
    const wbtcAmount = ethers.parseUnits("1", 8);
    const wbtcTx = await wbtc.mint(targetAddress, wbtcAmount);
    await wbtcTx.wait();
    console.log(`   ✅ 铸造 ${ethers.formatUnits(wbtcAmount, 8)} WBTC 完成`);

    // 检查余额
    console.log("\n4. 验证余额...");
    const ethBalance = await ethers.provider.getBalance(targetAddress);
    const usdcBalance = await usdc.balanceOf(targetAddress);
    const wbtcBalance = await wbtc.balanceOf(targetAddress);

    console.log("   📊 余额汇总:");
    console.log(`   ETH:  ${ethers.formatEther(ethBalance)}`);
    console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)}`);

    console.log("\n🎉 设置完成！");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});