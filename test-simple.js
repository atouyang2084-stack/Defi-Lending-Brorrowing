const { ethers } = require('ethers');

async function main() {
    console.log('测试合约连接...');

    // 使用本地Hardhat节点
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

    // 检查网络
    const network = await provider.getNetwork();
    console.log('网络:', network);

    // 检查账户
    const accounts = await provider.listAccounts();
    console.log('账户列表:', accounts);

    // USDC地址
    const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    // 简单的ERC20 ABI（仅balanceOf函数）
    const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)"
    ];

    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, provider);

    // 检查第一个账户的USDC余额
    const balance = await usdcContract.balanceOf(accounts[0]);
    console.log('账户', accounts[0], '的USDC余额:', ethers.formatUnits(balance, 6));

    // 检查LendingPool合约
    const lendingPoolAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

    // 简单的LendingPool ABI
    const lendingPoolAbi = [
        "function getReserveData(address asset) view returns (uint256 totalSupplyScaled, uint256 totalBorrowScaled, uint256 borrowIndex, uint256 protocolReserves, bool isActive)"
    ];

    const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolAbi, provider);

    const reserveData = await lendingPool.getReserveData(usdcAddress);
    console.log('USDC储备数据:');
    console.log('- totalSupplyScaled:', reserveData.totalSupplyScaled.toString());
    console.log('- totalBorrowScaled:', reserveData.totalBorrowScaled.toString());
    console.log('- borrowIndex:', reserveData.borrowIndex.toString());
    console.log('- protocolReserves:', reserveData.protocolReserves.toString());
    console.log('- isActive:', reserveData.isActive);

    // 计算可用流动性
    const usdcBalanceInPool = await usdcContract.balanceOf(lendingPoolAddress);
    console.log('池子中的USDC余额:', ethers.formatUnits(usdcBalanceInPool, 6));

    const availableLiquidity = usdcBalanceInPool - reserveData.protocolReserves;
    console.log('可用流动性:', ethers.formatUnits(availableLiquidity, 6), 'USDC');
}

main().catch(console.error);