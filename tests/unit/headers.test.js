import { describe, expect, test, afterEach, jest } from '@jest/globals'
import WalletManagerEvmErc4337, { WalletAccountReadOnlyEvmErc4337 } from '../../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const OWNER_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'
const TOKEN_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const PAYMASTER_ADDRESS = '0x888888888888Ec68A58AB8094Cc1AD20Ba3D2402'

const BUNDLER_URL = 'https://bundler.example.test'
const PAYMASTER_URL = 'https://paymaster.example.test'
const AUTH_HEADER = 'Bearer pk_test_headers'

// Replaces globalThis.fetch (used by AbstractionKit's HttpTransport) with a stub that records the
// headers of every JSON-RPC request and replies per method. `results` maps an RPC method name to
// the `result` it should return; unmapped methods resolve to null.
function mockFetch (captured, results = {}) {
  return jest.fn(async (url, init) => {
    const body = JSON.parse(init.body)
    captured.push({ url, headers: init.headers, method: body.method })
    return { json: async () => ({ jsonrpc: '2.0', id: body.id, result: results[body.method] ?? null }) }
  })
}

// Minimal EIP-1193 provider so the account's on-chain reads (chain id, deployment check, nonce)
// resolve without a live node. AbstractionKit routes these through `.request({ method })`.
function nodeProvider () {
  return {
    request: jest.fn(async ({ method }) => {
      switch (method) {
        case 'eth_chainId': return '0x1'
        case 'eth_getCode': return '0x1234' // any non-empty code => account already deployed
        case 'eth_call': return '0x' + '0'.repeat(64) // EntryPoint getNonce => 0
        default: return null
      }
    })
  }
}

describe('auth headers', () => {
  let originalFetch

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
    originalFetch = undefined
    jest.restoreAllMocks()
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
    globalThis.fetch = mockFetch(captured, {
      eth_chainId: '0x1',
      eth_estimateUserOperationGas: {
        callGasLimit: '0xc350',
        preVerificationGas: '0x7530',
        verificationGasLimit: '0x186a0'
      },
      pm_getPaymasterStubData: {
        paymaster: PAYMASTER_ADDRESS,
        paymasterData: '0x',
        paymasterVerificationGasLimit: '0x1',
        paymasterPostOpGasLimit: '0x1'
      },
      pm_getPaymasterData: {
        paymaster: PAYMASTER_ADDRESS,
        paymasterData: '0x'
      }
    })

    const account = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, {
      provider: nodeProvider(),
      bundlerUrl: BUNDLER_URL,
      safeModulesVersion: '0.3.0',
      paymasterUrl: PAYMASTER_URL,
      paymasterAddress: PAYMASTER_ADDRESS,
      paymasterToken: { address: TOKEN_ADDRESS },
      paymasterHeaders: { Authorization: AUTH_HEADER }
    })

    // A token-mode quote drives the full paymaster pipeline (stub -> estimate -> data) through the
    // public API, so the paymaster requests exercise the real HttpTransport that injects the headers.
    await account.quoteSendTransaction({
      to: OWNER_ADDRESS,
      value: 1,
      data: '0x',
      maxFeePerGas: 1_000_000_000,
      maxPriorityFeePerGas: 1_000_000_000
    })

    const paymasterCalls = captured.filter(call => call.url === PAYMASTER_URL)
    expect(paymasterCalls.length).toBeGreaterThan(0)
    for (const call of paymasterCalls) {
      expect(call.headers.Authorization).toBe(AUTH_HEADER)
    }
  })
})
