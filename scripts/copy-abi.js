const fs = require('fs');
const path = require('path');

// 源文件路径
const lendingPoolSource = path.join(__dirname, '../artifacts/contracts/src/core/LendingPool.sol/LendingPool.json');
const erc20Source = path.join(__dirname, '../artifacts/contracts/test/mocks/MockERC20.sol/MockERC20.json');
const chainlinkFeedSource = path.join(__dirname, '../artifacts/contracts/test/mocks/MockV3Aggregator.sol/MockV3Aggregator.json');
const contractAddressesPath = path.join(__dirname, '../contract-addresses.json');

// 目标文件路径
const frontendAbisDir = path.join(__dirname, '../frontend/src/web3/abis');
const lendingPoolTarget = path.join(frontendAbisDir, 'LendingPool.json');
const erc20Target = path.join(frontendAbisDir, 'ERC20.json');
const chainlinkFeedTarget = path.join(frontendAbisDir, 'ChainlinkFeed.json');
const addressesTarget = path.join(__dirname, '../frontend/src/web3/addresses.ts');

// 确保目标目录存在
if (!fs.existsSync(frontendAbisDir)) {
    fs.mkdirSync(frontendAbisDir, { recursive: true });
}

// 读取并提取ABI
function extractABI(sourcePath) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    const json = JSON.parse(content);
    return json.abi;
}

// 复制ABI文件
console.log('Copying LendingPool ABI...');
const lendingPoolABI = extractABI(lendingPoolSource);
fs.writeFileSync(lendingPoolTarget, JSON.stringify(lendingPoolABI, null, 2));

console.log('Copying ERC20 ABI...');
const erc20ABI = extractABI(erc20Source);
fs.writeFileSync(erc20Target, JSON.stringify(erc20ABI, null, 2));

console.log('Copying ChainlinkFeed ABI...');
const chainlinkFeedABI = extractABI(chainlinkFeedSource);
fs.writeFileSync(chainlinkFeedTarget, JSON.stringify(chainlinkFeedABI, null, 2));

// 复制合约地址
console.log('Copying contract addresses...');
const addresses = JSON.parse(fs.readFileSync(contractAddressesPath, 'utf8'));
const addressesContent = `export const ADDRESSES = {
    LENDING_POOL: "${addresses.LendingPool}" as const,
    USDC: "${addresses.USDC}" as const,
    WBTC: "${addresses.WBTC}" as const,
    USDC_ORACLE: "${addresses.USDCOracle}" as const,
    WBTC_ORACLE: "${addresses.WBTCOracle}" as const,
} as const;

export type Address = typeof ADDRESSES[keyof typeof ADDRESSES];
`;
fs.writeFileSync(addressesTarget, addressesContent);

console.log('ABI files and contract addresses copied successfully!');
