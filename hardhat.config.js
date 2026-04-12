require("@nomicfoundation/hardhat-toolbox"); // 或改成 require("@nomicfoundation/hardhat-ethers")

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      // Hardhat网络的默认配置
      chainId: 31337,
      gas: 16000000, // 降低到16M以下
      gasPrice: 8000000000,
      blockGasLimit: 30000000,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
    },
    // 如果你要连 npx hardhat node 启动的本地节点：
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      gas: 16000000, // 降低到16M以下
      gasPrice: 8000000000,
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
    }
  },
};
