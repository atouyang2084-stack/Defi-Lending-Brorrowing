const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔧 手动授权脚本");
    console.log("===============\n");

    // 你的地址
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 获取合约实例
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = MockERC20.attach(addresses.USDC);

    console.log("你的地址:", yourAddress);
    console.log("USDC地址:", addresses.USDC);
    console.log("LendingPool地址:", addresses.LendingPool);

    // 检查当前授权
    const currentAllowance = await usdc.allowance(yourAddress, addresses.LendingPool);
    console.log(`\n当前授权: ${ethers.formatUnits(currentAllowance, 6)} USDC`);

    // 授权选项
    const approveAmount = ethers.parseUnits("1000", 6); // 授权1000 USDC
    console.log(`\n将授权 ${ethers.formatUnits(approveAmount, 6)} USDC 给 LendingPool`);

    // 注意：我们无法用你的私钥签名，所以这个脚本只能模拟
    // 在实际操作中，你需要用你的钱包签名
    console.log("\n⚠️ 注意：这个脚本无法用你的私钥签名");
    console.log("在实际操作中，你需要：");
    console.log("1. 在前端点击授权按钮");
    console.log("2. 在MetaMask中确认授权交易");
    console.log("\n或者，如果你有私钥，可以：");
    console.log("1. 导入钱包到MetaMask");
    console.log("2. 连接前端");
    console.log("3. 在前端进行授权");

    // 模拟如果使用你的私钥会发生的步骤
    console.log("\n模拟授权步骤:");
    console.log("1. 调用 usdc.approve(LENDING_POOL, amount)");
    console.log("2. 发送交易到网络");
    console.log("3. 等待交易确认");
    console.log("4. 授权完成");

    // 使用一个测试账户演示
    console.log("\n使用测试账户演示授权:");
    const [deployer] = await ethers.getSigners();

    // 给测试账户USDC
    await usdc.connect(deployer).mint(deployer.address, approveAmount);

    console.log(`测试账户 ${deployer.address} 授权...`);
    const approveTx = await usdc.connect(deployer).approve(addresses.LendingPool, approveAmount);
    await approveTx.wait();

    const newAllowance = await usdc.allowance(deployer.address, addresses.LendingPool);
    console.log(`新授权: ${ethers.formatUnits(newAllowance, 6)} USDC`);

    // 检查你的地址的解决方案
    console.log("\n💡 针对你的地址的解决方案:");
    console.log("1. 确保你的钱包已连接到Hardhat本地网络");
    console.log("2. 在前端USDC Market页面，输入存款金额");
    console.log("3. 点击Deposit按钮");
    console.log("4. MetaMask应该弹出授权窗口");
    console.log("5. 确认授权交易");
    console.log("6. 授权完成后，再次点击Deposit按钮");
    console.log("7. MetaMask应该弹出存款交易确认");
    console.log("8. 确认存款交易");

    // 常见问题排查
    console.log("\n🔍 常见问题排查:");
    console.log("Q: MetaMask没有弹出授权窗口");
    console.log("A: 检查浏览器是否阻止了弹出窗口，或检查控制台错误");

    console.log("\nQ: 授权交易失败");
    console.log("A: 检查Gas设置，或网络连接");

    console.log("\nQ: 授权成功但存款仍然失败");
    console.log("A: 检查前端是否等待授权确认，或刷新页面");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});