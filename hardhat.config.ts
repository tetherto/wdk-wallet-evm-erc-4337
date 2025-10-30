import { HardhatUserConfig } from 'hardhat/config'
import hardhatNetworkHelpers from '@nomicfoundation/hardhat-network-helpers'

export default {
  solidity: '0.8.24',
  networks: {
    base: {
      type: 'edr-simulated',
      chainType: 'op',
      chainId: 8453,
      accounts: {
        mnemonic: 'anger burst story spy face pattern whale quit delay fiction ball solve',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 3,
        accountsBalance: '1000000000000000000000',
      },
      forking: {
        url: 'https://mainnet.base.org',
      },
    },
  },
  plugins: [hardhatNetworkHelpers],
} satisfies HardhatUserConfig
