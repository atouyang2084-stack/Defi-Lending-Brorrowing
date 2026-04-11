const fs = require('fs');
const path = require('path');

// 源文件路径
const lendingPoolSource = path.join(__dirname, '../artifacts/contracts/src/core/LendingPool.sol/LendingPool.json');
const erc20Source = path.join(__dirname, '../artifacts/contracts/test/mocks/MockERC20.sol/MockERC20.json');

// 目标文件路径
const frontendAbisDir = path.join(__dirname, '../frontend/src/web3/abis');
const lendingPoolTarget = path.join(frontendAbisDir, 'LendingPool.json');
const erc20Target = path.join(frontendAbisDir, 'ERC20.json');

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

console.log('ABI files copied successfully!');
