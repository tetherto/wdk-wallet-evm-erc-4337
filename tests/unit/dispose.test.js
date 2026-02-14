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
