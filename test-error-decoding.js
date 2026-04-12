const { ethers } = require('ethers');

async function main() {
    console.log('测试错误解码...\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

    // 完整的LendingPool ABI（包含错误定义）
    const lendingPoolAbi = [
        // 错误定义
        "error InsufficientLiquidity()",
        "error InvalidAmount()",

        // 函数
        "function repay(tuple(address asset, uint256 amount, address onBehalfOf) params) returns (uint256)",
        "function borrow(tuple(address asset, uint256 amount, address onBehalfOf) params)",

        // 视图函数
        "function getReserveData(address asset) view returns (uint256 totalSupplyScaled, uint256 totalBorrowScaled, uint256 borrowIndex, uint256 protocolReserves, bool isActive)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, provider);

    console.log('测试1: 直接调用borrow函数（应该失败）');
    console.log('--------------------------------------');

    try {
        // 使用callStatic来模拟调用而不发送交易
        await lendingPool.borrow.staticCall({
            asset: usdcAddress,
            amount: ethers.parseUnits('1000', 6), // 大金额，应该失败
            onBehalfOf: '0x0c78605e5B8eFf915d4782d919a65b56F5337928'
        });
        console.log('✅ 调用成功（不应该发生）');
    } catch (error) {
        console.log('❌ 调用失败（预期中）');
        console.log('完整错误对象:');
        console.log('- code:', error.code);
        console.log('- message:', error.message);
        console.log('- shortMessage:', error.shortMessage);
        console.log('- data:', error.data);
        console.log('- reason:', error.reason);
        console.log('- info:', error.info);


        if (error.data && error.data !== '0x') {
            console.log('\n尝试解码错误数据...');
            try {
                // 尝试解码错误
                const decodedError = lendingPool.interface.parseError(error.data);
                console.log('解码后的错误:', decodedError?.name);
                console.log('错误签名:', decodedError?.signature);
            } catch (decodeError) {
                console.log('无法解码错误:', decodeError.message);
            }
        }
    }

    console.log('\n测试2: 检查池子状态');
    console.log('-------------------');

    const reserveData = await lendingPool.getReserveData(usdcAddress);
    console.log('池子协议储备:', ethers.formatUnits(reserveData.protocolReserves, 6), 'USDC');

    // 检查USDC余额
    const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);
    const poolBalance = await usdcContract.balanceOf(lendingPoolAddress);
    console.log('池子USDC余额:', ethers.formatUnits(poolBalance, 6), 'USDC');

    const availableLiquidity = poolBalance - reserveData.protocolReserves;
    console.log('可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');

    console.log('\n测试3: 尝试解码已知错误');
    console.log('-----------------------');

    // 创建一些测试错误数据
    const errorInterface = new ethers.Interface([
        "error InsufficientLiquidity()",
        "error InvalidAmount()",
        "error AssetNotSupported(address)"
    ]);

    // InsufficientLiquidity错误的编码
    const insufficientLiquiditySelector = errorInterface.getError('InsufficientLiquidity').selector;
    console.log('InsufficientLiquidity selector:', insufficientLiquiditySelector);

    // 模拟一个InsufficientLiquidity错误
    const simulatedErrorData = insufficientLiquiditySelector;
    console.log('模拟错误数据:', simulatedErrorData);

    try {
        const decoded = errorInterface.parseError(simulatedErrorData);
        console.log('解码结果:', decoded?.name);
    } catch (err) {
        console.log('解码失败:', err.message);
    }

    console.log('\n前端可能遇到的问题:');
    console.log('1. 错误选择器不匹配');
    console.log('2. ABI不完整');
    console.log('3. 错误信息在传输中被改变');
    console.log('4. 前端错误处理逻辑有问题');
}

main().catch(console.error);