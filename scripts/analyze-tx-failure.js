const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 分析交易失败原因");
    console.log("===================\n");

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LendingPool = await ethers.getContractFactory("LendingPool");

    const usdc = MockERC20.attach(addresses.USDC);
    const pool = LendingPool.attach(addresses.LendingPool);

    console.log("你的地址:", yourAddress);
    console.log("USDC地址:", addresses.USDC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 检查当前状态
    console.log("\n当前状态检查:");
    const balance = await usdc.balanceOf(yourAddress);
    const allowance = await usdc.allowance(yourAddress, addresses.LendingPool);
    const supply = await pool.userSupplyBalance(yourAddress, addresses.USDC);

    console.log(`余额: ${ethers.formatUnits(balance, 6)} USDC`);
    console.log(`授权: ${ethers.formatUnits(allowance, 6)} USDC`);
    console.log(`存款: ${ethers.formatUnits(supply, 6)} USDC`);

    // 模拟前端交易
    console.log("\n模拟前端存款交易:");
    const depositAmount = ethers.parseUnits("10", 6);
    const depositParams = {
        asset: addresses.USDC,
        amount: depositAmount,
        onBehalfOf: yourAddress
    };

    console.log("存款参数:", {
        asset: depositParams.asset,
        amount: depositParams.amount.toString(),
        amountUSDC: ethers.formatUnits(depositParams.amount, 6),
        onBehalfOf: depositParams.onBehalfOf
    });

    // 检查授权是否足够
    if (allowance < depositAmount) {
        console.log(`\n⚠️ 授权不足!`);
        console.log(`需要: ${ethers.formatUnits(depositAmount, 6)} USDC`);
        console.log(`当前: ${ethers.formatUnits(allowance, 6)} USDC`);
        console.log(`缺少: ${ethers.formatUnits(depositAmount - allowance, 6)} USDC`);
    } else {
        console.log(`\n✅ 授权足够`);
    }

    // 尝试直接调用（使用一个测试账户）
    console.log("\n尝试直接调用（使用测试账户）:");
    const [deployer] = await ethers.getSigners();

    // 给deployer USDC并授权
    await usdc.connect(deployer).mint(deployer.address, depositAmount);
    await usdc.connect(deployer).approve(addresses.LendingPool, depositAmount);

    try {
        const tx = await pool.connect(deployer).deposit(depositParams);
        console.log("交易已发送...");
        const receipt = await tx.wait();
        console.log("✅ 存款成功");
        console.log("交易哈希:", receipt.hash);
        console.log("Gas used:", receipt.gasUsed.toString());

        // 检查事件
        const events = receipt.logs.map(log => {
            try {
                return pool.interface.parseLog(log);
            } catch {
                return null;
            }
        }).filter(event => event !== null);

        console.log("事件:", events);
    } catch (error) {
        console.log("❌ 存款失败:", error.message);

        // 分析错误
        analyzeError(error, usdc, pool, addresses, yourAddress);
    }

    // 常见失败原因
    console.log("\n🔍 常见交易失败原因:");
    console.log("1. 授权不足 - 最常见");
    console.log("2. 余额不足");
    console.log("3. Gas不足");
    console.log("4. 网络问题");
    console.log("5. 合约revert（如InvalidAmount, InsufficientLiquidity）");
    console.log("6. 前端参数错误");

    // 建议
    console.log("\n💡 建议:");
    console.log("1. 检查前端控制台错误信息");
    console.log("2. 检查MetaMask中的错误详情");
    console.log("3. 尝试小额存款（如1 USDC）");
    console.log("4. 确保有足够ETH支付Gas");
    console.log("5. 检查网络连接（Hardhat本地网络）");
}

function analyzeError(error, usdc, pool, addresses, userAddress) {
    console.log("\n错误分析:");

    if (error.message.includes("InsufficientLiquidity")) {
        console.log("错误: InsufficientLiquidity");
        console.log("可能原因:");
        console.log("1. 授权不足（MockERC20返回false）");
        console.log("2. 余额不足");
    }

    if (error.message.includes("InvalidAmount")) {
        console.log("错误: InvalidAmount");
        console.log("可能原因: amount = 0 或 scaled = 0");
    }

    if (error.message.includes("panic code 0x11")) {
        console.log("错误: 算术溢出 (panic code 0x11)");
        console.log("可能原因: MockERC20.transferFrom中的算术溢出");
    }

    if (error.message.includes("ERC20")) {
        console.log("错误: ERC20相关");
        console.log("可能原因: 授权不足或余额不足");
    }

    if (error.message.includes("revert")) {
        console.log("错误: 合约revert");
        console.log("需要检查合约具体revert原因");
    }

    // 检查具体数值
    console.log("\n检查具体数值:");
    try {
        const reserveData = pool.getReserveData(addresses.USDC);
        console.log("Reserve数据获取成功");
    } catch (e) {
        console.log("无法获取reserve数据:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});