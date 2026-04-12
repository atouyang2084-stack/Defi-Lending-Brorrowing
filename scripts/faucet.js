#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");
const readline = require("readline");

// 创建命令行交互接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function main() {
    console.log("🎯 DeFi Lending Protocol - 测试代币水龙头");
    console.log("==========================================\n");

    // 检查合约地址文件
    if (!fs.existsSync("contract-addresses.json")) {
        console.log("❌ 错误: contract-addresses.json 文件不存在");
        console.log("请先部署合约：");
        console.log("  npx hardhat run contracts/script/deploy.js --network localhost");
        rl.close();
        return;
    }

    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));
    const [deployer] = await ethers.getSigners();

    console.log("部署账户:", deployer.address);
    console.log("部署账户余额:", ethers.formatEther(await deployer.getBalance()), "ETH\n");

    // 获取目标地址
    let targetAddress = process.env.TARGET_ADDRESS;

    if (!targetAddress) {
        targetAddress = await askQuestion("请输入你的钱包地址 (0x开头): ");
    }

    // 验证地址格式
    if (!targetAddress || targetAddress.length !== 42 || !targetAddress.startsWith("0x")) {
        console.log("❌ 地址格式错误！必须是0x开头的42位地址");
        rl.close();
        return;
    }

    console.log("\n📋 目标账户:", targetAddress);
    console.log("将发送以下测试代币：");
    console.log("  - 10 ETH (Gas费用)");
    console.log("  - 100,000 USDC");
    console.log("  - 1 WBTC\n");

    const confirm = await askQuestion("是否继续？(y/n): ");
    if (confirm.toLowerCase() !== 'y') {
        console.log("操作已取消");
        rl.close();
        return;
    }

    try {
        // 获取合约实例
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = MockERC20.attach(addresses.USDC);
        const wbtc = MockERC20.attach(addresses.WBTC);

        console.log("\n🚀 开始发送测试代币...");

        // 1. 发送ETH
        console.log("1. 发送ETH...");
        const ethAmount = ethers.parseEther("10");
        const ethTx = await deployer.sendTransaction({
            to: targetAddress,
            value: ethAmount
        });
        await ethTx.wait();
        console.log(`   ✅ 发送 ${ethers.formatEther(ethAmount)} ETH 完成`);
        console.log(`   交易哈希: ${ethTx.hash}`);

        // 2. 铸造USDC
        console.log("2. 铸造USDC...");
        const usdcAmount = ethers.parseUnits("100000", 6);
        const usdcTx = await usdc.mint(targetAddress, usdcAmount);
        await usdcTx.wait();
        console.log(`   ✅ 铸造 ${ethers.formatUnits(usdcAmount, 6)} USDC 完成`);
        console.log(`   交易哈希: ${usdcTx.hash}`);

        // 3. 铸造WBTC
        console.log("3. 铸造WBTC...");
        const wbtcAmount = ethers.parseUnits("1", 8);
        const wbtcTx = await wbtc.mint(targetAddress, wbtcAmount);
        await wbtcTx.wait();
        console.log(`   ✅ 铸造 ${ethers.formatUnits(wbtcAmount, 8)} WBTC 完成`);
        console.log(`   交易哈希: ${wbtcTx.hash}`);

        // 检查余额
        console.log("\n4. 验证余额...");
        const ethBalance = await ethers.provider.getBalance(targetAddress);
        const usdcBalance = await usdc.balanceOf(targetAddress);
        const wbtcBalance = await wbtc.balanceOf(targetAddress);

        console.log("   📊 余额汇总:");
        console.log(`   ETH:  ${ethers.formatEther(ethBalance)}`);
        console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
        console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)}`);

        console.log("\n🎉 测试代币发送完成！");
        console.log("\n💡 下一步操作：");
        console.log("1. 打开前端: http://localhost:5173");
        console.log("2. 连接钱包");
        console.log("3. 开始测试存款、借款、还款功能");

    } catch (error) {
        console.error("\n❌ 发送失败:", error.message);
        console.log("\n🔧 可能的原因：");
        console.log("1. Hardhat节点未运行 - 运行: npx hardhat node");
        console.log("2. 合约未部署 - 运行: npx hardhat run contracts/script/deploy.js --network localhost");
        console.log("3. 部署账户余额不足 - 检查部署账户ETH余额");
    } finally {
        rl.close();
    }
}

// 处理命令行参数
if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = { main };