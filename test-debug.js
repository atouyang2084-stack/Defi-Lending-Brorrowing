const { ethers } = require('ethers');

async function main() {
    console.log('调试储备数据...');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

    // 扩展的LendingPool ABI
    const lendingPoolAbi = [
        "function getReserveData(address asset) view returns (uint256 totalSupplyScaled, uint256 totalBorrowScaled, uint256 borrowIndex, uint256 protocolReserves, bool isActive)",
        "function userSupplyBalance(address user, address asset) view returns (uint256)",
        "function userBorrowBalance(address user, address asset) view returns (uint256)",
        "function totalSupply(address asset) view returns (uint256)",
        "function totalBorrow(address asset) view returns (uint256)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, provider);

    const reserveData = await lendingPool.getReserveData(usdcAddress);
    console.log('USDC储备数据:');
    console.log('- totalSupplyScaled:', reserveData.totalSupplyScaled.toString());
    console.log('- totalBorrowScaled:', reserveData.totalBorrowScaled.toString());
    console.log('- borrowIndex:', reserveData.borrowIndex.toString());
    console.log('- protocolReserves:', ethers.formatUnits(reserveData.protocolReserves, 6), 'USDC');
    console.log('- isActive:', reserveData.isActive);

    // 检查总存款和总借款
    const totalSupply = await lendingPool.totalSupply(usdcAddress);
    const totalBorrow = await lendingPool.totalBorrow(usdcAddress);
    console.log('\n总存款:', ethers.formatUnits(totalSupply, 6), 'USDC');
    console.log('总借款:', ethers.formatUnits(totalBorrow, 6), 'USDC');

    // 检查第一个账户的存款和借款
    const accounts = await provider.listAccounts();
    const userSupply = await lendingPool.userSupplyBalance(accounts[0], usdcAddress);
    const userBorrow = await lendingPool.userBorrowBalance(accounts[0], usdcAddress);
    console.log('\n账户', accounts[0], ':');
    console.log('- 存款余额:', ethers.formatUnits(userSupply, 6), 'USDC');
    console.log('- 借款余额:', ethers.formatUnits(userBorrow, 6), 'USDC');

    // 检查第二个账户（你的测试账户）
    const testAccount = '0x0c78605e5B8eFf915d4782d919a65b56F5337928';
    const testUserSupply = await lendingPool.userSupplyBalance(testAccount, usdcAddress);
    const testUserBorrow = await lendingPool.userBorrowBalance(testAccount, usdcAddress);
    console.log('\n测试账户', testAccount, ':');
    console.log('- 存款余额:', ethers.formatUnits(testUserSupply, 6), 'USDC');
    console.log('- 借款余额:', ethers.formatUnits(testUserBorrow, 6), 'USDC');

    // 检查USDC余额
    const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);

    const poolUsdcBalance = await usdcContract.balanceOf(lendingPoolAddress);
    console.log('\n池子USDC余额:', ethers.formatUnits(poolUsdcBalance, 6), 'USDC');

    const testAccountUsdcBalance = await usdcContract.balanceOf(testAccount);
    console.log('测试账户USDC余额:', ethers.formatUnits(testAccountUsdcBalance, 6), 'USDC');

    // 计算可用流动性
    const availableLiquidity = poolUsdcBalance - reserveData.protocolReserves;
    console.log('\n可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');

    // 检查是否有人借款
    if (totalBorrow > 0n) {
        console.log('\n⚠️ 注意：池子中已有借款，这会影响可用流动性！');
        console.log('如果你想测试还款，需要先有借款余额。');
    }
}

main().catch(console.error);