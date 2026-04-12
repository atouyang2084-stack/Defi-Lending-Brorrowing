const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    const [deployer] = await ethers.getSigners();
    console.log("使用部署账户:", deployer.address);

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);
    const wbtc = MockERC20.attach(addresses.WBTC);

    // 输入你的钱包地址
    const yourAddress = "0xYOUR_WALLET_ADDRESS_HERE"; // 替换为你的钱包地址

    if (yourAddress === "0xYOUR_WALLET_ADDRESS_HERE") {
        console.log("❌ 请先替换脚本中的钱包地址！");
        console.log("1. 打开此文件: scripts/mint-to-account.js");
        console.log("2. 将 '0xYOUR_WALLET_ADDRESS_HERE' 替换为你的钱包地址");
        console.log("3. 重新运行此脚本");
        return;
    }

    console.log("给你的地址铸造测试代币:", yourAddress);

    // 铸造USDC (100,000 USDC, 6位小数)
    const usdcAmount = ethers.parseUnits("100000", 6);
    console.log(`铸造 ${ethers.formatUnits(usdcAmount, 6)} USDC...`);
    const usdcTx = await usdc.mint(yourAddress, usdcAmount);
    await usdcTx.wait();
    console.log("✅ USDC铸造成功");

    // 铸造WBTC (1 WBTC, 8位小数)
    const wbtcAmount = ethers.parseUnits("1", 8);
    console.log(`铸造 ${ethers.formatUnits(wbtcAmount, 8)} WBTC...`);
    const wbtcTx = await wbtc.mint(yourAddress, wbtcAmount);
    await wbtcTx.wait();
    console.log("✅ WBTC铸造成功");

    // 检查余额
    const usdcBalance = await usdc.balanceOf(yourAddress);
    const wbtcBalance = await wbtc.balanceOf(yourAddress);

    console.log("\n🎉 铸造完成！");
    console.log(`你的USDC余额: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    console.log(`你的WBTC余额: ${ethers.formatUnits(wbtcBalance, 8)} WBTC`);

    // 还需要给一些ETH作为Gas
    console.log("\n⚠️ 注意：你还需要一些ETH作为Gas费用");
    console.log("请使用Hardhat测试账户发送一些ETH到你的地址");
    console.log("或使用以下命令手动发送：");
    console.log(`npx hardhat --network localhost send-eth --to ${yourAddress} --amount 10`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});