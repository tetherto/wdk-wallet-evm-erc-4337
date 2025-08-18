require('@nomicfoundation/hardhat-ethers')

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  networks: {
    hardhat: {
      chainId: 1,
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        accountsBalance: '10000000000000000000000'
      },
      forking: {
        url: 'https://ethereum-rpc.publicnode.com',
        blockNumber: 22897572,
        enabled: true
      },
      mining: {
        autoMine: true,
        interval: [0, 0]
      }
    }
  }
}
