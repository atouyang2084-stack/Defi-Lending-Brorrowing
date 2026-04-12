const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("发送账户:", deployer.address);
    console.log("余额:", ethers.formatEther(await deployer.getBalance()), "ETH");

    // 输入接收地址和金额
    const toAddress = "0xYOUR_WALLET_ADDRESS_HERE"; // 替换为你的钱包地址
    const amount = ethers.parseEther("10"); // 发送10 ETH

    if (toAddress === "0xYOUR_WALLET_ADDRESS_HERE") {
        console.log("❌ 请先替换脚本中的钱包地址！");
        console.log("1. 打开此文件: scripts/send-eth.js");
        console.log("2. 将 '0xYOUR_WALLET_ADDRESS_HERE' 替换为你的钱包地址");
        console.log("3. 重新运行此脚本");
        return;
    }

    console.log(`发送 ${ethers.formatEther(amount)} ETH 到 ${toAddress}...`);

    // 发送ETH
    const tx = await deployer.sendTransaction({
        to: toAddress,
        value: amount
    });

    await tx.wait();
    console.log("✅ ETH发送成功！交易哈希:", tx.hash);

    // 检查接收方余额
    const receiverBalance = await ethers.provider.getBalance(toAddress);
    console.log(`接收方余额: ${ethers.formatEther(receiverBalance)} ETH`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});