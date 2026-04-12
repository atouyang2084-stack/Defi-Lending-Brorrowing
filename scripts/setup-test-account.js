const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🚀 设置测试账户脚本");
    console.log("====================\n");

    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);
    const wbtc = MockERC20.attach(addresses.WBTC);

    // 从命令行参数获取地址，或使用默认值
    let yourAddress = process.argv[2];

    if (!yourAddress || yourAddress.length !== 42 || !yourAddress.startsWith("0x")) {
        console.log("❌ 请提供有效的以太坊地址作为参数");
        console.log("用法: npx hardhat run scripts/setup-test-account.js --network localhost <你的钱包地址>");
        console.log("示例: npx hardhat run scripts/setup-test-account.js --network localhost 0x742d35Cc6634C0532925a3b844Bc9e90F1b6c1a3");
        return;
    }

    console.log("设置账户:", yourAddress);
    console.log("");

    // 1. 发送ETH作为Gas
    console.log("1. 发送ETH...");
    const ethAmount = ethers.parseEther("10");
    const ethTx = await deployer.sendTransaction({
        to: yourAddress,
        value: ethAmount
    });
    await ethTx.wait();
    console.log(`   ✅ 发送 ${ethers.formatEther(ethAmount)} ETH 完成`);

    // 2. 铸造USDC
    console.log("2. 铸造USDC...");
    const usdcAmount = ethers.parseUnits("100000", 6);
    const usdcTx = await usdc.mint(yourAddress, usdcAmount);
    await usdcTx.wait();
    console.log(`   ✅ 铸造 ${ethers.formatUnits(usdcAmount, 6)} USDC 完成`);

    // 3. 铸造WBTC
    console.log("3. 铸造WBTC...");
    const wbtcAmount = ethers.parseUnits("1", 8);
    const wbtcTx = await wbtc.mint(yourAddress, wbtcAmount);
    await wbtcTx.wait();
    console.log(`   ✅ 铸造 ${ethers.formatUnits(wbtcAmount, 8)} WBTC 完成`);

    // 检查余额
    console.log("\n4. 验证余额...");
    const ethBalance = await ethers.provider.getBalance(yourAddress);
    const usdcBalance = await usdc.balanceOf(yourAddress);
    const wbtcBalance = await wbtc.balanceOf(yourAddress);

    console.log("   📊 余额汇总:");
    console.log(`   ETH:  ${ethers.formatEther(ethBalance)}`);
    console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)}`);

    console.log("\n🎉 设置完成！");
    console.log("现在你可以：");
    console.log("1. 在MetaMask中切换到Hardhat Local网络");
    console.log("2. 导入你的钱包（使用私钥）");
    console.log("3. 访问 http://localhost:5174");
    console.log("4. 连接钱包并开始测试");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});