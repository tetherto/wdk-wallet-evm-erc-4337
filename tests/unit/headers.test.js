import { describe, expect, test, afterEach, jest } from '@jest/globals'
import WalletManagerEvmErc4337, { WalletAccountReadOnlyEvmErc4337 } from '../../index.js'
import { isHttpTransport } from 'abstractionkit'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const OWNER_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

const BUNDLER_URL = 'https://bundler.example.test'
const PAYMASTER_URL = 'https://paymaster.example.test'
const AUTH_HEADER = 'Bearer pk_test_headers'

// Replaces globalThis.fetch (used by AbstractionKit's HttpTransport) with a stub that records the
// headers of every JSON-RPC request and replies with a well-formed response.
function mockFetch (captured, result = null) {
  return jest.fn(async (url, init) => {
    const body = JSON.parse(init.body)
    captured.push({ url, headers: init.headers, method: body.method })
    return { json: async () => ({ jsonrpc: '2.0', id: body.id, result }) }
  })
}

describe('auth headers', () => {
  let originalFetch

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
    originalFetch = undefined
    jest.restoreAllMocks()
  })

  describe('_rpcTarget', () => {
    test('returns the plain url when no headers are configured', () => {
      expect(WalletAccountReadOnlyEvmErc4337._rpcTarget(BUNDLER_URL)).toBe(BUNDLER_URL)
      expect(WalletAccountReadOnlyEvmErc4337._rpcTarget(BUNDLER_URL, undefined)).toBe(BUNDLER_URL)
    })

    test('wraps the url in an HttpTransport carrying the headers when configured', () => {
      const target = WalletAccountReadOnlyEvmErc4337._rpcTarget(BUNDLER_URL, { Authorization: AUTH_HEADER })

      expect(isHttpTransport(target)).toBe(true)
      expect(target.url).toBe(BUNDLER_URL)
      expect(target.options.headers).toEqual({ Authorization: AUTH_HEADER })
    })
  })

  test('bundlerHeaders are sent on every bundler request', async () => {
    const captured = []
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch(captured)

    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, {
      chainId: 1,
      provider: 'http://localhost:8545',
      bundlerUrl: BUNDLER_URL,
      bundlerHeaders: { Authorization: AUTH_HEADER },
      safeModulesVersion: '0.3.0',
      useNativeCoins: true
    })

    const account = await wallet.getAccountByPath("0'/0/0")
    await account.getUserOperationReceipt('0x' + '0'.repeat(64))

    const bundlerCalls = captured.filter(call => call.url === BUNDLER_URL)
    expect(bundlerCalls.length).toBeGreaterThan(0)
    for (const call of bundlerCalls) {
      expect(call.headers.Authorization).toBe(AUTH_HEADER)
    }
  })

  test('no Authorization header is sent when bundlerHeaders is not configured', async () => {
    const captured = []
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch(captured)

    const wallet = new WalletManagerEvmErc4337(SEED_PHRASE, {
      chainId: 1,
      provider: 'http://localhost:8545',
      bundlerUrl: BUNDLER_URL,
      safeModulesVersion: '0.3.0',
      useNativeCoins: true
    })

    const account = await wallet.getAccountByPath("0'/0/0")
    await account.getUserOperationReceipt('0x' + '0'.repeat(64))

    const bundlerCalls = captured.filter(call => call.url === BUNDLER_URL)
    expect(bundlerCalls.length).toBeGreaterThan(0)
    for (const call of bundlerCalls) {
      expect(call.headers.Authorization).toBeUndefined()
    }
  })

  test('paymasterHeaders are sent on every paymaster request', async () => {
    const captured = []
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch(captured, {})

    const account = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, {
      chainId: 1,
      provider: 'http://localhost:8545',
      bundlerUrl: BUNDLER_URL,
      safeModulesVersion: '0.3.0',
      isSponsored: true,
      paymasterUrl: PAYMASTER_URL,
      paymasterHeaders: { Authorization: AUTH_HEADER }
    })

    const paymaster = account._getPaymaster(PAYMASTER_URL, {}, account._config.paymasterHeaders)
    await paymaster.sendRPCRequest('pm_getPaymasterStubData', [])

    const paymasterCalls = captured.filter(call => call.url === PAYMASTER_URL)
    expect(paymasterCalls.length).toBeGreaterThan(0)
    for (const call of paymasterCalls) {
      expect(call.headers.Authorization).toBe(AUTH_HEADER)
    }
  })
})
