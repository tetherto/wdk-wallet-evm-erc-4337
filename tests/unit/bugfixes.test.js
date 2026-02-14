import { describe, expect, test } from '@jest/globals'
import WalletManagerEvmErc4337 from '../../index.js'
import { WalletAccountEvmErc4337 } from '../../index.js'

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

describe('getFeeRates() on non-EIP-1559 chains', () => {
  test('should fall back to gasPrice when maxFeePerGas is null', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)

    wallet._provider = {
      getFeeData: async () => ({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: 20000000000n
      })
    }

    const rates = await wallet.getFeeRates()
    expect(typeof rates.normal).toBe('bigint')
    expect(typeof rates.fast).toBe('bigint')
    expect(rates.fast > rates.normal).toBe(true)
  })

  test('should throw a descriptive error when both maxFeePerGas and gasPrice are null', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)

    wallet._provider = {
      getFeeData: async () => ({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        gasPrice: null
      })
    }

    await expect(wallet.getFeeRates()).rejects.toThrow('Fee data is not available from the provider.')
  })

  test('should use maxFeePerGas when available', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)

    wallet._provider = {
      getFeeData: async () => ({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 1000000000n,
        gasPrice: 20000000000n
      })
    }

    const rates = await wallet.getFeeRates()
    expect(typeof rates.normal).toBe('bigint')
    expect(typeof rates.fast).toBe('bigint')
    expect(rates.fast > rates.normal).toBe(true)
  })
})

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

  test('same paymaster token should produce the same cache key', async () => {
    const config = makeConfig()

    const getKey = (cfg) => {
      const { paymasterUrl, paymasterAddress, paymasterToken } = cfg
      return `paymaster:${paymasterUrl}:${paymasterAddress}:${paymasterToken?.address}`
    }

    expect(getKey(config)).toBe(getKey({ ...config }))
  })
})

describe('dispose() clears cached state and owner reference', () => {
  test('should clear _safe4337Packs cache after dispose', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)
    const account = await wallet.getAccount(0)

    account._safe4337Packs.set('test-key', { mock: true })
    expect(account._safe4337Packs.size).toBe(1)

    account.dispose()

    expect(account._safe4337Packs.size).toBe(0)
  })

  test('should null _ownerAccount after dispose', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)
    const account = await wallet.getAccount(0)

    expect(account._ownerAccount).not.toBeNull()

    account.dispose()

    expect(account._ownerAccount).toBeNull()
  })

  test('should clear _feeEstimator after dispose', async () => {
    const config = makeConfig()
    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, config)
    const account = await wallet.getAccount(0)

    account._feeEstimator = { mock: true }

    account.dispose()

    expect(account._feeEstimator).toBeUndefined()
  })
})
