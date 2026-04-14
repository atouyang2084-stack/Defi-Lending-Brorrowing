const { ethers } = require('ethers');

async function main() {
    console.log('=== 模拟价格下跌以触发清算 ===\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

    // 读取地址
    const addresses = require('../contract-addresses.json');
    const wbtcOracleAddress = addresses.WBTCOracle;

    console.log('WBTC预言机地址:', wbtcOracleAddress);

    // 使用管理员账户（账户0）
    const adminPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    // Chainlink Aggregator ABI
    const aggregatorABI = [
        "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
        "function updateAnswer(int256 answer) external"
    ];

    const oracle = new ethers.Contract(wbtcOracleAddress, aggregatorABI, adminWallet);

    try {
        // 1. 获取当前价格
        console.log('1. 获取当前WBTC价格...');
        const roundData = await oracle.latestRoundData();
        const currentPrice = roundData.answer;
        console.log('当前WBTC价格:', ethers.formatUnits(currentPrice, 8), 'USD (8 decimals)');

        // 2. 计算下跌后的价格（下跌到$15,000）
        const targetPrice = ethers.parseUnits('15000', 8); // $15,000
        console.log('当前WBTC价格:', ethers.formatUnits(currentPrice, 8), 'USD');
        console.log('目标WBTC价格:', ethers.formatUnits(targetPrice, 8), 'USD');

        // 3. 更新价格
        console.log('2. 更新预言机价格...');
        const updateTx = await oracle.updateAnswer(targetPrice);
        await updateTx.wait();
        console.log('✅ 价格更新成功');

        // 4. 验证新价格
        console.log('3. 验证新价格...');
        const newRoundData = await oracle.latestRoundData();
        const verifiedPrice = newRoundData.answer;
        console.log('验证后的WBTC价格:', ethers.formatUnits(verifiedPrice, 8), 'USD');

        console.log('\n=== 价格更新完成 ===');
        console.log('现在WBTC价格已下跌50%，这应该会使借款人的健康因子低于1，触发清算条件。');

    } catch (error) {
        console.error('操作失败:', error.message);
    }
}

main().catch(console.error);