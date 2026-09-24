import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { ValueError } from '@tetherto/wdk-wallet'

const actualEthers = await import('ethers')

const getFeeDataMock = jest.fn()

const JsonRpcProviderMock = jest.fn().mockImplementation(() => ({ getFeeData: getFeeDataMock }))
const BrowserProviderMock = jest.fn().mockImplementation(() => ({ getFeeData: getFeeDataMock }))

jest.unstable_mockModule('ethers', () => ({
  ...actualEthers,
  JsonRpcProvider: JsonRpcProviderMock,
  BrowserProvider: BrowserProviderMock
}))

const { default: WalletManagerEvmErc4337 } = await import('../index.js')

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const SPONSORED_CONFIG = {
  provider: 'https://dummy-provider.url/',
  bundlerUrl: 'https://dummy-bundler.url/',
  paymasterUrl: 'https://dummy-paymaster.url/',
  safeModulesVersion: '0.3.0',
  isSponsored: true
}

describe('@tetherto/wdk-wallet-evm-erc-4337', () => {
  describe('WalletManagerEvmErc4337', () => {
    let wallet

    beforeEach(() => {
      jest.clearAllMocks()

      wallet = new WalletManagerEvmErc4337(SEED_PHRASE, SPONSORED_CONFIG)
    })

    afterEach(() => {
      wallet.dispose()
    })

    describe('constructor', () => {
      test('should initialize a wallet with a provider url', () => {
        expect(JsonRpcProviderMock).toHaveBeenCalledTimes(1)
        expect(JsonRpcProviderMock.mock.calls[0][0]).toBe(SPONSORED_CONFIG.provider)
      })

      test('should initialize a wallet with a list of provider urls', () => {
        const failoverWallet = new WalletManagerEvmErc4337(SEED_PHRASE, {
          ...SPONSORED_CONFIG,
          provider: ['https://primary.url/', 'https://failover.url/']
        })

        const urls = JsonRpcProviderMock.mock.calls.map(([url]) => url)
        expect(urls).toContain('https://primary.url/')
        expect(urls).toContain('https://failover.url/')

        failoverWallet.dispose()
      })

      test('should throw if the provider is an empty list', () => {
        expect(() => new WalletManagerEvmErc4337(SEED_PHRASE, { ...SPONSORED_CONFIG, provider: [] }))
          .toThrow(ValueError)
        expect(() => new WalletManagerEvmErc4337(SEED_PHRASE, { ...SPONSORED_CONFIG, provider: [] }))
          .toThrow("The 'provider' option cannot be set to an empty list.")
      })
    })

    describe('getAccount', () => {
      test('should return the account at index 0 by default', async () => {
        const account = await wallet.getAccount()

        expect(account.index).toBe(0)
        expect(account.path).toBe("m/44'/60'/0'/0/0")
      })

      test('should return the account at the given index', async () => {
        const account = await wallet.getAccount(3)

        expect(account.index).toBe(3)
        expect(account.path).toBe("m/44'/60'/0'/0/3")
      })

      test('should cache and return the same account for the same index', async () => {
        const account1 = await wallet.getAccount(0)
        const account2 = await wallet.getAccount(0)

        expect(account1).toBe(account2)
      })

      test('should throw if the index is a negative number', async () => {
        await expect(wallet.getAccount(-1))
          .rejects.toThrow('invalid path component')
      })
    })

    describe('getAccountByPath', () => {
      test('should return the account with the given path', async () => {
        const account = await wallet.getAccountByPath("1'/2/3")

        expect(account.index).toBe(3)
        expect(account.path).toBe("m/44'/60'/1'/2/3")
      })

      test('should throw if the path is invalid', async () => {
        await expect(wallet.getAccountByPath("a'/b/c"))
          .rejects.toThrow('invalid path component')
      })
    })

    describe('getFeeRates', () => {
      test('should return the correct fee rates', async () => {
        const DUMMY_FEE_DATA = {
          maxFeePerGas: 10_000_000_000n,
          gasPrice: null
        }

        getFeeDataMock.mockResolvedValue(DUMMY_FEE_DATA)

        const feeRates = await wallet.getFeeRates()

        expect(feeRates.normal).toBe(11_000_000_000n)
        expect(feeRates.fast).toBe(20_000_000_000n)
        expect(getFeeDataMock).toHaveBeenCalledTimes(1)
      })

      test('should use gasPrice when maxFeePerGas is not available', async () => {
        const DUMMY_FEE_DATA = {
          maxFeePerGas: null,
          gasPrice: 5_000_000_000n
        }

        getFeeDataMock.mockResolvedValue(DUMMY_FEE_DATA)

        const feeRates = await wallet.getFeeRates()

        expect(feeRates.normal).toBe(5_500_000_000n)
        expect(feeRates.fast).toBe(10_000_000_000n)
        expect(getFeeDataMock).toHaveBeenCalledTimes(1)
      })

      test('should return the correct fee rates with a failover provider', async () => {
        const DUMMY_FEE_DATA = {
          maxFeePerGas: 10_000_000_000n,
          gasPrice: null
        }

        getFeeDataMock.mockResolvedValue(DUMMY_FEE_DATA)

        const failoverWallet = new WalletManagerEvmErc4337(SEED_PHRASE, {
          ...SPONSORED_CONFIG,
          provider: ['https://primary.url/', 'https://failover.url/']
        })

        const feeRates = await failoverWallet.getFeeRates()

        expect(feeRates.normal).toBe(11_000_000_000n)
        expect(feeRates.fast).toBe(20_000_000_000n)
        expect(getFeeDataMock).toHaveBeenCalledTimes(1)
        const urls = JsonRpcProviderMock.mock.calls.map(([url]) => url)
        expect(urls).toContain('https://primary.url/')
        expect(urls).toContain('https://failover.url/')
      })

      test('should throw if the provider does not return any fee data', async () => {
        const DUMMY_FEE_DATA = {
          maxFeePerGas: null,
          gasPrice: null
        }

        getFeeDataMock.mockResolvedValue(DUMMY_FEE_DATA)

        await expect(wallet.getFeeRates())
          .rejects.toThrow(/Cannot mix BigInt/)
      })
    })

    describe('dispose', () => {
      test('should dispose the wallet and erase the private keys of the accounts', async () => {
        const account = await wallet.getAccount(0)

        wallet.dispose()

        expect(account.keyPair.privateKey).toBeNull()
      })
    })
  })
})
