import { HardhatUserConfig } from 'hardhat/config'

export default {
  solidity: '0.8.24',
  networks: {
    localnet: {
      type: 'edr-simulated',
      chainType: 'l1',
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
} satisfies HardhatUserConfig
