import { describe, expect, test } from '@jest/globals'
import WalletManagerEvmErc4337 from '../../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

function makeConfig (overrides = {}) {
  return {
    chainId: 1,
    provider: 'http://localhost:8545',
    bundlerUrl: 'http://localhost:4337',
    paymasterUrl: 'http://localhost:3000',
    entryPointAddress: ENTRY_POINT_ADDRESS,
    paymasterAddress: '0x0000000000000000000000000000000000000001',
    safeModulesVersion: '0.3.0',
    paymasterToken: {
      address: '0x0000000000000000000000000000000000000002'
    },
    ...overrides
  }
}

describe('Safe4337Pack cache key includes paymasterToken address', () => {
  test('different paymaster tokens should produce different cache keys', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)
    const account = await wallet.getAccount(0)

    const config1 = { ...config, paymasterToken: { address: '0xTokenA' } }
    const config2 = { ...config, paymasterToken: { address: '0xTokenB' } }

    const getKey = (cfg) => {
      const { paymasterUrl, paymasterAddress, paymasterToken } = cfg
      return `paymaster:${paymasterUrl}:${paymasterAddress}:${paymasterToken?.address}`
    }

    expect(getKey(config1)).not.toBe(getKey(config2))
  })

  test('same paymaster token should produce the same cache key', () => {
    const config = makeConfig()

    const getKey = (cfg) => {
      const { paymasterUrl, paymasterAddress, paymasterToken } = cfg
      return `paymaster:${paymasterUrl}:${paymasterAddress}:${paymasterToken?.address}`
    }

    expect(getKey(config)).toBe(getKey({ ...config }))
  })
})
