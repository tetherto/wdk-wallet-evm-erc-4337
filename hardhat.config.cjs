require('@nomicfoundation/hardhat-ethers')

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  networks: {
    hardhat: {
      chainId: 1, // Use mainnet chain ID for the fork
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        accountsBalance: '10000000000000000000000' // 10,000 ETH each
      },
      forking: {
        url: 'https://ethereum-rpc.publicnode.com',
        blockNumber: 22897572, // After EntryPoint deployment (19274877)
        enabled: true
      },
      mining: {
        autoMine: true,
        interval: [0, 0]
      }
    }
  }
}
