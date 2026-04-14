const { ethers } = require('ethers');

async function restorePrice() {
    console.log('=== 恢复WBTC价格到初始值 ===\n');

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

        // 2. 恢复到初始价格（$30,000）
        const originalPrice = ethers.parseUnits('30000', 8); // $30,000
        console.log('目标WBTC价格:', ethers.formatUnits(originalPrice, 8), 'USD');

        // 3. 更新价格
        console.log('2. 更新预言机价格...');
        const updateTx = await oracle.updateAnswer(originalPrice);
        await updateTx.wait();
        console.log('✅ 价格更新成功');

        // 4. 验证新价格
        console.log('3. 验证新价格...');
        const newRoundData = await oracle.latestRoundData();
        const verifiedPrice = newRoundData.answer;
        console.log('验证后的WBTC价格:', ethers.formatUnits(verifiedPrice, 8), 'USD');

        console.log('\n=== 价格恢复完成 ===');
        console.log('WBTC价格已恢复到$30,000，现在可以重新演示价格下跌和清算流程。');

        // 5. 检查主要账户的健康因子
        console.log('\n=== 检查账户健康因子 ===');

        const lendingPoolAddress = addresses.LendingPool;
        const lendingPoolABI = [
            "function healthFactor(address user) view returns (uint256)",
            "function userBorrowBalance(address user, address asset) view returns (uint256)",
            "function userSupplyBalance(address user, address asset) view returns (uint256)"
        ];

        const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolABI, provider);

        // 常用测试账户
        const testAccounts = [
            { name: '账户0 (管理员)', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
            { name: '账户1', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
            { name: '账户2', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
            { name: '账户3', address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
            { name: '账户4', address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' },
            { name: '账户5', address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' }
        ];

        for (const account of testAccounts) {
            try {
                const hf = await lendingPool.healthFactor(account.address);
                const hfFormatted = ethers.formatUnits(hf, 27);

                console.log(`${account.name} (${account.address}):`);
                console.log(`  健康因子: ${hfFormatted}`);

                // 检查是否有债务
                const usdcDebt = await lendingPool.userBorrowBalance(account.address, addresses.USDC);
                if (usdcDebt > 0) {
                    console.log(`  USDC债务: ${ethers.formatUnits(usdcDebt, 6)} USDC`);
                }

                // 检查是否有抵押品
                const wbtcSupply = await lendingPool.userSupplyBalance(account.address, addresses.WBTC);
                if (wbtcSupply > 0) {
                    console.log(`  WBTC抵押: ${ethers.formatUnits(wbtcSupply, 8)} WBTC`);
                }

                console.log('');
            } catch (error) {
                console.log(`${account.name}: 无法获取数据`);
            }
        }

    } catch (error) {
        console.error('操作失败:', error.message);
    }
}

restorePrice().catch(console.error);