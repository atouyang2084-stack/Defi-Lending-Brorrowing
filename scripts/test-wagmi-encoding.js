const { ethers } = require("hardhat");
const fs = require("fs");

// 模拟wagmi的writeContract调用
async function main() {
    console.log("🔍 测试wagmi编码方式");
    console.log("===================\n");

    // 读取合约地址
    const addresses = JSON.parse(fs.readFileSync("contract-addresses.json", "utf8"));

    // 读取ABI
    const lendingPoolABI = JSON.parse(fs.readFileSync("frontend/src/web3/abis/LendingPool.json", "utf8"));

    // 查找deposit函数
    const depositABI = lendingPoolABI.find(item => item.name === "deposit" && item.type === "function");
    console.log("deposit函数ABI:", JSON.stringify(depositABI, null, 2));

    // 模拟前端参数
    const yourAddress = "0x0c78605e5B8eFf915d4782d919a65b56F5337928";
    const depositAmount = ethers.parseUnits("1", 6);

    const depositParams = {
        asset: addresses.USDC,
        amount: depositAmount,
        onBehalfOf: yourAddress
    };

    console.log("\n前端参数:");
    console.log(JSON.stringify({
        asset: depositParams.asset,
        amount: depositParams.amount.toString(),
        onBehalfOf: depositParams.onBehalfOf
    }, null, 2));

    // 使用ethers编码
    console.log("\n使用ethers编码:");
    const iface = new ethers.Interface(lendingPoolABI);

    try {
        const encodedData = iface.encodeFunctionData("deposit", [depositParams]);
        console.log("编码后的calldata:", encodedData);

        // 解码验证
        const decoded = iface.decodeFunctionData("deposit", encodedData);
        console.log("\n解码验证:");
        console.log("decoded:", decoded);

        // 检查参数
        const [p] = decoded;
        console.log("\n解码后的参数:");
        console.log("asset:", p.asset);
        console.log("amount:", p.amount.toString());
        console.log("onBehalfOf:", p.onBehalfOf);

        // 比较
        console.log("\n参数比较:");
        console.log("asset匹配:", p.asset === depositParams.asset);
        console.log("amount匹配:", p.amount === depositParams.amount);
        console.log("onBehalfOf匹配:", p.onBehalfOf === depositParams.onBehalfOf);
    } catch (error) {
        console.log("编码错误:", error.message);
    }

    // 测试不同的参数格式
    console.log("\n测试不同的参数格式:");

    // 格式1: 对象（应该是正确的）
    const format1 = [depositParams];
    console.log("\n格式1 - 对象数组:");
    console.log("参数:", format1);

    try {
        const data1 = iface.encodeFunctionData("deposit", format1);
        console.log("编码成功");
    } catch (error) {
        console.log("编码失败:", error.message);
    }

    // 格式2: 展开的对象（错误的方式）
    const format2 = [depositParams.asset, depositParams.amount, depositParams.onBehalfOf];
    console.log("\n格式2 - 展开的参数:");
    console.log("参数:", format2);

    try {
        const data2 = iface.encodeFunctionData("deposit", format2);
        console.log("编码成功（但可能不正确）");
    } catch (error) {
        console.log("编码失败:", error.message);
    }

    // 检查前端实际调用
    console.log("\n检查前端useDeposit hook:");
    console.log("前端调用方式:");
    console.log(`writeContract({
  address: ADDRESSES.LENDING_POOL,
  abi: lendingPoolABI,
  functionName: 'deposit',
  args: [params],  // params是DepositParams对象
})`);

    // 模拟前端可能的问题
    console.log("\n模拟前端可能的问题:");

    // 问题1: args不是数组
    console.log("\n问题1: args不是数组（直接传递对象）");
    try {
        // 这是错误的，但前端可能这样写
        const wrongData = iface.encodeFunctionData("deposit", depositParams); // 不是数组
        console.log("❌ 不应该成功");
    } catch (error) {
        console.log("✅ 正确失败:", error.message);
    }

    // 问题2: 参数顺序错误
    console.log("\n问题2: 参数顺序错误");
    const wrongOrderParams = {
        onBehalfOf: yourAddress,
        amount: depositAmount,
        asset: addresses.USDC
    };

    try {
        const data = iface.encodeFunctionData("deposit", [wrongOrderParams]);
        console.log("编码成功（顺序不影响，因为是命名参数）");
    } catch (error) {
        console.log("编码失败:", error.message);
    }

    // 问题3: 缺少参数
    console.log("\n问题3: 缺少onBehalfOf参数");
    const missingParams = {
        asset: addresses.USDC,
        amount: depositAmount
        // 缺少onBehalfOf
    };

    try {
        const data = iface.encodeFunctionData("deposit", [missingParams]);
        console.log("❌ 编码成功（但合约调用会失败）");
    } catch (error) {
        console.log("✅ 编码失败:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});