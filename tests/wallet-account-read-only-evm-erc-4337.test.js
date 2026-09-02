import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { Contract } from 'ethers'
import { NoSuchElementError, TransactionError, TransactionErrorReason, UnsupportedOperationError, ValueError, WdkError } from '@tetherto/wdk-wallet'

const actualWalletEvm = await import('@tetherto/wdk-wallet-evm')
const actualAk = await import('abstractionkit')

const getBalanceMock = jest.fn()
const getTokenBalanceMock = jest.fn()
const getTokenBalancesMock = jest.fn()
const getAllowanceMock = jest.fn()
const evmGetTransactionReceiptMock = jest.fn()
const evmGetTransactionMock = jest.fn()
const verifyMock = jest.fn()
const verifyTypedDataMock = jest.fn()

const WalletAccountReadOnlyEvmMock = jest.fn().mockImplementation(() => ({
  getBalance: getBalanceMock,
  getTokenBalance: getTokenBalanceMock,
  getTokenBalances: getTokenBalancesMock,
  getAllowance: getAllowanceMock,
  getTransactionReceipt: evmGetTransactionReceiptMock,
  getTransaction: evmGetTransactionMock,
  verify: verifyMock,
  verifyTypedData: verifyTypedDataMock
}))

Object.defineProperties(WalletAccountReadOnlyEvmMock, Object.getOwnPropertyDescriptors(actualWalletEvm.WalletAccountReadOnlyEvm))

jest.unstable_mockModule('@tetherto/wdk-wallet-evm', () => ({
  ...actualWalletEvm,
  WalletAccountReadOnlyEvm: WalletAccountReadOnlyEvmMock
}))

const isDeployedMock = jest.fn()
const createUserOperationMock = jest.fn()
const sendUserOperationMock = jest.fn()
const getUserOperationReceiptMock = jest.fn()
const getUserOperationByHashMock = jest.fn()
const createPaymasterUserOperationMock = jest.fn()
const sendRPCRequestMock = jest.fn()
const fetchAccountNonceMock = jest.fn()

const SafeAccountMock = jest.fn().mockImplementation((address) => ({
  accountAddress: address,
  entrypointAddress: actualAk.ENTRYPOINT_V7,
  createUserOperation: createUserOperationMock
}))
SafeAccountMock.createAccountAddress = actualAk.SafeAccountV0_3_0.createAccountAddress.bind(actualAk.SafeAccountV0_3_0)
SafeAccountMock.isDeployed = isDeployedMock

const BundlerMock = jest.fn().mockImplementation(() => ({
  sendUserOperation: sendUserOperationMock,
  getUserOperationReceipt: getUserOperationReceiptMock,
  getUserOperationByHash: getUserOperationByHashMock
}))

const Erc7677PaymasterMock = jest.fn().mockImplementation(() => ({
  createPaymasterUserOperation: createPaymasterUserOperationMock,
  sendRPCRequest: sendRPCRequestMock
}))
Erc7677PaymasterMock.detectProvider = actualAk.Erc7677Paymaster.detectProvider

jest.unstable_mockModule('abstractionkit', () => ({
  ...actualAk,
  SafeAccountV0_3_0: SafeAccountMock,
  Bundler: BundlerMock,
  Erc7677Paymaster: Erc7677PaymasterMock,
  fetchAccountNonce: fetchAccountNonceMock
}))

const { WalletAccountReadOnlyEvmErc4337, ConfigurationError } = await import('../index.js')

const OWNER_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'
const SAFE_ADDRESS = '0x120Ac3c0B46fBAf2e8452A23BD61a2Da9B139551'
const EXISTING_SAFE_ADDRESS = '0xFE0847a52f1C75A01B06cFC636c87683E72a6029'
const SPENDER = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
const TOKEN_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const INIT_CODE_OVERRIDES = {
  c2Nonce: BigInt('0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6'),
  entrypointAddress: actualAk.ENTRYPOINT_V7,
  safe4337ModuleAddress: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226',
  safeModuleSetupAddress: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47'
}

const DUMMY_BALANCE = 1_000_000_000_000_000_000n
const DUMMY_TOKEN_BALANCE = 1_000_000n
const DUMMY_ALLOWANCE = 500_000n

const DUMMY_USER_OP_HASH = '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1'
const DUMMY_TX_HASH = '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4'

const DUMMY_USER_OP_RECEIPT = {
  userOpHash: DUMMY_USER_OP_HASH,
  success: true,
  actualGasCost: 42_000_000_000_000n,
  receipt: {
    transactionHash: DUMMY_TX_HASH
  }
}

const DUMMY_TX_RECEIPT = {
  hash: DUMMY_TX_HASH,
  blockNumber: 12345,
  status: 1,
  gasUsed: 21000n
}

const DUMMY_EVM_TX_INFO = {
  hash: DUMMY_TX_HASH,
  finality: 'confirmed',
  success: true,
  block: '0x' + '22'.repeat(32),
  fee: 21_000n * 2_000_000_000n,
  confirmations: 3,
  receipt: DUMMY_TX_RECEIPT
}

const DUMMY_USER_OP = {
  sender: SAFE_ADDRESS,
  nonce: 0n,
  callData: '0x',
  callGasLimit: 50_000n,
  verificationGasLimit: 100_000n,
  preVerificationGas: 30_000n,
  maxFeePerGas: 10_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
  signature: '0x'
}

const EIP1193_PROVIDER = {
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_chainId') return '0x1'
    return null
  })
}

const SPONSORED_CONFIG = {
  provider: EIP1193_PROVIDER,
  bundlerUrl: 'https://dummy-bundler.url/',
  paymasterUrl: 'https://dummy-paymaster.url/',
  safeModulesVersion: '0.3.0',
  isSponsored: true
}

const PAYMASTER_TOKEN_CONFIG = {
  provider: EIP1193_PROVIDER,
  bundlerUrl: 'https://dummy-bundler.url/',
  paymasterUrl: 'https://dummy-paymaster.url/',
  paymasterAddress: '0x888888888888Ec68A58AB8094Cc1AD20Ba3D2402',
  paymasterToken: { address: TOKEN_ADDRESS },
  safeModulesVersion: '0.3.0'
}

const NATIVE_COINS_CONFIG = {
  provider: EIP1193_PROVIDER,
  bundlerUrl: 'https://dummy-bundler.url/',
  safeModulesVersion: '0.3.0',
  useNativeCoins: true
}

describe('@tetherto/wdk-wallet-evm-erc-4337', () => {
  describe('WalletAccountReadOnlyEvmErc4337', () => {
    let account

    beforeEach(() => {
      jest.clearAllMocks()

      isDeployedMock.mockResolvedValue(true)
      createUserOperationMock.mockResolvedValue({ ...DUMMY_USER_OP })
      createPaymasterUserOperationMock.mockResolvedValue({ userOperation: { ...DUMMY_USER_OP } })
      fetchAccountNonceMock.mockResolvedValue(0n)

      account = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, SPONSORED_CONFIG)
    })

    describe('constructor', () => {
      test('should successfully initialize a read-only account at the predicted safe address', async () => {
        const address = await account.getAddress()

        expect(address).toBe(SAFE_ADDRESS)
      })

      test('should throw if the safe modules version is not supported', () => {
        expect(() => new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...SPONSORED_CONFIG, safeModulesVersion: '0.2.0' }))
          .toThrow(new ConfigurationError('Unsupported safe modules version: 0.2.0'))
      })

      test('should throw a configuration error that is part of the wdk error taxonomy', () => {
        expect(() => new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...SPONSORED_CONFIG, safeModulesVersion: '0.2.0' }))
          .toThrow(ValueError)
        expect(() => new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...SPONSORED_CONFIG, safeModulesVersion: '0.2.0' }))
          .toThrow(WdkError)
      })

      test('should throw if the provider is an empty list', () => {
        expect(() => new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...SPONSORED_CONFIG, provider: [] }))
          .toThrow(ValueError)
        expect(() => new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...SPONSORED_CONFIG, provider: [] }))
          .toThrow("The 'provider' option cannot be set to an empty list.")
      })

      test('should pass the caller\'s configuration object through unchanged', async () => {
        await account.getBalance()

        expect(WalletAccountReadOnlyEvmMock.mock.calls[0][1]).toBe(SPONSORED_CONFIG)
      })
    })

    describe('_getChainId', () => {
      const TRANSACTION = { to: SPENDER, value: 1, data: '0x' }

      test('should throw if the provider reports a chain other than the configured chainId', async () => {
        // EIP1193_PROVIDER answers eth_chainId with 0x1 (mainnet).
        const mismatched = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...NATIVE_COINS_CONFIG, chainId: 137 })

        await expect(mismatched.quoteSendTransaction(TRANSACTION))
          .rejects.toThrow(new ConfigurationError('Provider is on chain 1 but the wallet is configured for chain 137'))
        expect(isDeployedMock).not.toHaveBeenCalled()
        expect(createUserOperationMock).not.toHaveBeenCalled()
      })

      test('should return the chain id when it matches the configured chainId', async () => {
        const matched = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, { ...NATIVE_COINS_CONFIG, chainId: 1 })

        await expect(matched._getChainId()).resolves.toBe(1n)
      })

      test('should not enforce a chain when chainId is omitted from the config', async () => {
        await expect(account._getChainId()).resolves.toBe(1n)
      })

      test('should read the chain id from the provider only once', async () => {
        EIP1193_PROVIDER.request.mockClear()

        await account._getChainId()
        await account._getChainId()

        const chainIdCalls = EIP1193_PROVIDER.request.mock.calls.filter(([{ method }]) => method === 'eth_chainId')
        expect(chainIdCalls).toHaveLength(1)
      })
    })

    describe('predictSafeAddress', () => {
      test('should return the address computed by abstractionkit', () => {
        const address = WalletAccountReadOnlyEvmErc4337.predictSafeAddress(OWNER_ADDRESS, { safeModulesVersion: '0.3.0' })

        expect(address).toBe(SAFE_ADDRESS)
      })

      test('should derive the same address when an on-chain identifier is configured', () => {
        const address = WalletAccountReadOnlyEvmErc4337.predictSafeAddress(OWNER_ADDRESS, {
          safeModulesVersion: '0.3.0',
          onChainIdentifier: 'my-project'
        })

        expect(address).toBe(SAFE_ADDRESS)
      })
    })

    describe('fromSafeAddress', () => {
      test('should use the given safe address without deriving one from it', async () => {
        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, SPONSORED_CONFIG)

        const address = await safeAccount.getAddress()

        expect(address).toBe(EXISTING_SAFE_ADDRESS)
        expect(address).not.toBe(WalletAccountReadOnlyEvmErc4337.predictSafeAddress(EXISTING_SAFE_ADDRESS, SPONSORED_CONFIG))
      })

      test('should read the balance of the given safe address', async () => {
        getBalanceMock.mockResolvedValue(DUMMY_BALANCE)

        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, SPONSORED_CONFIG)
        const balance = await safeAccount.getBalance()

        expect(balance).toBe(DUMMY_BALANCE)
        expect(WalletAccountReadOnlyEvmMock).toHaveBeenCalledWith(EXISTING_SAFE_ADDRESS, SPONSORED_CONFIG)
        expect(Object.getOwnPropertySymbols(WalletAccountReadOnlyEvmMock.mock.calls[0][1])).toEqual([])
      })

      test('should quote against the given safe address', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, PAYMASTER_TOKEN_CONFIG)
        const { fee } = await safeAccount.quoteSendTransaction({ to: SPENDER, value: 1, data: '0x' })

        expect(fee).toBe(600_000n)
        expect(SafeAccountMock).toHaveBeenCalledWith(EXISTING_SAFE_ADDRESS, INIT_CODE_OVERRIDES)
      })

      test('should throw if the safe modules version is not supported', () => {
        expect(() => WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, { ...SPONSORED_CONFIG, safeModulesVersion: '0.2.0' }))
          .toThrow(new ConfigurationError('Unsupported safe modules version: 0.2.0'))
      })

      test('should normalize a lowercase safe address to its checksummed form', async () => {
        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS.toLowerCase(), SPONSORED_CONFIG)

        const address = await safeAccount.getAddress()

        expect(address).toBe(EXISTING_SAFE_ADDRESS)
      })

      test('should throw if the safe address is not a well-formed evm address', () => {
        expect(() => WalletAccountReadOnlyEvmErc4337.fromSafeAddress('not-an-address', SPONSORED_CONFIG))
          .toThrow(new ConfigurationError('Invalid safe address: not-an-address'))
      })

      test('should throw when verifying a message because the safe owner is unknown', async () => {
        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, SPONSORED_CONFIG)

        await expect(safeAccount.verify('Dummy message to sign.', '0xdead'))
          .rejects.toThrow(new UnsupportedOperationError('verify(message, signature)'))
        expect(verifyMock).not.toHaveBeenCalled()
      })

      test('should throw when verifying typed data because the safe owner is unknown', async () => {
        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, SPONSORED_CONFIG)

        await expect(safeAccount.verifyTypedData({ domain: {}, types: {}, message: {} }, '0xdead'))
          .rejects.toThrow(new UnsupportedOperationError('verifyTypedData(typedData, signature)'))
        expect(verifyTypedDataMock).not.toHaveBeenCalled()
      })

      test('should throw when quoting for a safe that is not deployed', async () => {
        isDeployedMock.mockResolvedValue(false)

        const safeAccount = WalletAccountReadOnlyEvmErc4337.fromSafeAddress(EXISTING_SAFE_ADDRESS, PAYMASTER_TOKEN_CONFIG)

        await expect(safeAccount.quoteSendTransaction({ to: SPENDER, value: 1, data: '0x' }))
          .rejects.toThrow(new ConfigurationError(`The safe at ${EXISTING_SAFE_ADDRESS} is not deployed. An account created from a safe address cannot build the safe's deployment data, which requires the owner's address.`))
      })
    })

    describe('getBalance', () => {
      test('should return the correct balance of the account', async () => {
        getBalanceMock.mockResolvedValue(DUMMY_BALANCE)

        const balance = await account.getBalance()

        expect(balance).toBe(DUMMY_BALANCE)
        expect(WalletAccountReadOnlyEvmMock).toHaveBeenCalledWith(SAFE_ADDRESS, SPONSORED_CONFIG)
      })
    })

    describe('getTokenBalance', () => {
      test('should return the correct token balance', async () => {
        getTokenBalanceMock.mockResolvedValue(DUMMY_TOKEN_BALANCE)

        const balance = await account.getTokenBalance(TOKEN_ADDRESS)

        expect(balance).toBe(DUMMY_TOKEN_BALANCE)
        expect(getTokenBalanceMock).toHaveBeenCalledWith(TOKEN_ADDRESS)
      })
    })

    describe('getTokenBalances', () => {
      test('should return the correct token balances for multiple tokens', async () => {
        const SECOND_TOKEN_ADDRESS = '0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        const DUMMY_BALANCES = {
          [TOKEN_ADDRESS]: DUMMY_TOKEN_BALANCE,
          [SECOND_TOKEN_ADDRESS]: 2_000_000n
        }

        getTokenBalancesMock.mockResolvedValue(DUMMY_BALANCES)

        const balances = await account.getTokenBalances([TOKEN_ADDRESS, SECOND_TOKEN_ADDRESS])

        expect(balances).toEqual(DUMMY_BALANCES)
        expect(getTokenBalancesMock).toHaveBeenCalledWith([TOKEN_ADDRESS, SECOND_TOKEN_ADDRESS])
      })
    })

    describe('getPaymasterTokenBalance', () => {
      test('should return the paymaster token balance', async () => {
        getTokenBalanceMock.mockResolvedValue(DUMMY_TOKEN_BALANCE)

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)
        const balance = await pmAccount.getPaymasterTokenBalance()

        expect(balance).toBe(DUMMY_TOKEN_BALANCE)
        expect(getTokenBalanceMock).toHaveBeenCalledWith(TOKEN_ADDRESS)
      })

      test('should throw if the paymaster token is not configured', async () => {
        await expect(account.getPaymasterTokenBalance())
          .rejects.toThrow(new ConfigurationError('Paymaster token is not configured.'))
      })
    })

    describe('getAllowance', () => {
      test('should return the correct allowance', async () => {
        getAllowanceMock.mockResolvedValue(DUMMY_ALLOWANCE)

        const allowance = await account.getAllowance(TOKEN_ADDRESS, SPENDER)

        expect(allowance).toBe(DUMMY_ALLOWANCE)
        expect(getAllowanceMock).toHaveBeenCalledWith(TOKEN_ADDRESS, SPENDER)
      })
    })

    describe('quoteSendTransaction', () => {
      const TRANSACTION = { to: SPENDER, value: 1, data: '0x' }

      test('should return zero fee for sponsored transactions', async () => {
        const { fee } = await account.quoteSendTransaction(TRANSACTION)

        expect(fee).toBe(0n)
        expect(createUserOperationMock).not.toHaveBeenCalled()
      })

      test('should return the fee in paymaster token base units with the tolerance applied', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)
        const { fee } = await pmAccount.quoteSendTransaction(TRANSACTION)

        expect(fee).toBe(600_000n)
        expect(SafeAccountMock).toHaveBeenCalledWith(SAFE_ADDRESS, INIT_CODE_OVERRIDES)
        expect(createPaymasterUserOperationMock).toHaveBeenCalledWith(
          SafeAccountMock.mock.results[0].value,
          { ...DUMMY_USER_OP },
          PAYMASTER_TOKEN_CONFIG.bundlerUrl,
          { token: TOKEN_ADDRESS },
          { entrypoint: actualAk.ENTRYPOINT_V7 }
        )
        expect(createPaymasterUserOperationMock).toHaveBeenCalledTimes(1)
      })

      test('should quote a batch of transactions in a single user operation', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)

        const { fee } = await pmAccount.quoteSendTransaction([
          { to: SPENDER, value: 1, data: '0x' },
          { to: TOKEN_ADDRESS, value: 0, data: '0xdead' }
        ])

        expect(fee).toBe(600_000n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [
            { to: SPENDER, value: 1n, data: '0x' },
            { to: TOKEN_ADDRESS, value: 0n, data: '0xdead' }
          ],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })

      test('should return the fee in native coins with the tolerance applied when useNativeCoins is set', async () => {
        const nativeAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, NATIVE_COINS_CONFIG)

        const { fee } = await nativeAccount.quoteSendTransaction(TRANSACTION)

        // The real gas math over DUMMY_USER_OP: (50_000 + 100_000 + 30_000) * 10 gwei * 120% tolerance.
        expect(fee).toBe(2_160_000_000_000_000n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: SPENDER, value: 1n, data: '0x' }],
          EIP1193_PROVIDER,
          NATIVE_COINS_CONFIG.bundlerUrl,
          {}
        )
        expect(createPaymasterUserOperationMock).not.toHaveBeenCalled()
      })

      test('should forward the transaction gas overrides to the paymaster', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)
        await pmAccount.quoteSendTransaction({ ...TRANSACTION, callGasLimit: 111_111 })

        expect(createPaymasterUserOperationMock).toHaveBeenCalledWith(
          SafeAccountMock.mock.results[0].value,
          { ...DUMMY_USER_OP },
          PAYMASTER_TOKEN_CONFIG.bundlerUrl,
          { token: TOKEN_ADDRESS },
          { entrypoint: actualAk.ENTRYPOINT_V7, callGasLimit: 111_111n }
        )
      })

      test('should fetch gas prices via pimlico_getUserOperationGasPrice when the bundler URL is Pimlico', async () => {
        const PIMLICO_BUNDLER = 'https://api.pimlico.io/v2/1/rpc?apikey=test'

        sendRPCRequestMock.mockResolvedValue({
          fast: { maxFeePerGas: '0x174876e800', maxPriorityFeePerGas: '0x77359400' }
        })
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, {
          ...PAYMASTER_TOKEN_CONFIG,
          bundlerUrl: PIMLICO_BUNDLER
        })
        await pmAccount.quoteSendTransaction(TRANSACTION)

        expect(sendRPCRequestMock).toHaveBeenCalledWith('pimlico_getUserOperationGasPrice', [])
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: SPENDER, value: 1n, data: '0x' }],
          EIP1193_PROVIDER,
          undefined,
          {
            skipGasEstimation: true,
            maxFeePerGas: 100_000_000_000n,
            maxPriorityFeePerGas: 2_000_000_000n
          }
        )
      })

      test('should re-validate the merged config when a per-call override is provided', async () => {
        await expect(account.quoteSendTransaction(TRANSACTION, { isSponsored: false }))
          .rejects.toThrow('Missing required paymaster token configuration fields: paymasterAddress, paymasterToken.')
      })

      test('should throw if both isSponsored and useNativeCoins are set', async () => {
        await expect(account.quoteSendTransaction(TRANSACTION, { useNativeCoins: true }))
          .rejects.toThrow("Cannot use both 'isSponsored: true' and 'useNativeCoins: true'. Please use only one.")
      })

      test('should reframe AA50 errors from abstractionkit as a paymaster token funds error', async () => {
        createPaymasterUserOperationMock.mockRejectedValue(
          new actualAk.AbstractionKitError('SIMULATE_PAYMASTER_VALIDATION', 'AA50: paymaster deposit too low')
        )

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)

        const promise = pmAccount.quoteSendTransaction(TRANSACTION)

        await expect(promise).rejects.toThrow(TransactionError)
        await expect(promise).rejects.toThrow('Token paymaster requires the account to hold the paymaster token for fee estimation.')
        await expect(promise).rejects.toMatchObject({ reason: TransactionErrorReason.INSUFFICIENT_BALANCE })
      })

      test('should propagate non-AbstractionKitError errors from the paymaster', async () => {
        createPaymasterUserOperationMock.mockRejectedValue(new Error('boom'))

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)

        await expect(pmAccount.quoteSendTransaction(TRANSACTION))
          .rejects.toThrow('boom')
      })

      test('should throw when the paymaster RPC returns a different paymaster address than configured', async () => {
        const WRONG_PAYMASTER = '0x1111111111111111111111111111111111111111'

        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP, paymaster: WRONG_PAYMASTER },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)

        await expect(pmAccount.quoteSendTransaction(TRANSACTION))
          .rejects.toThrow(/paymasterAddress mismatch.*0x1111111111111111111111111111111111111111/)
      })

      test('should pass through when the paymaster RPC returns the configured paymaster address (case-insensitive)', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP, paymaster: PAYMASTER_TOKEN_CONFIG.paymasterAddress.toLowerCase() },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)

        const { fee } = await pmAccount.quoteSendTransaction(TRANSACTION)

        expect(fee).toBe(600_000n)
      })
    })

    describe('quoteTransfer', () => {
      const TRANSFER = { token: TOKEN_ADDRESS, recipient: SPENDER, amount: 100n }

      test('should return zero fee for sponsored transfers', async () => {
        const { fee } = await account.quoteTransfer(TRANSFER)

        expect(fee).toBe(0n)
      })

      test('should return the fee in paymaster token base units for non-sponsored transfers', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const abi = ['function transfer(address to, uint256 amount) returns (bool)']
        const contract = new Contract(TOKEN_ADDRESS, abi)
        const expectedData = contract.interface.encodeFunctionData('transfer', [SPENDER, TRANSFER.amount])

        const pmAccount = new WalletAccountReadOnlyEvmErc4337(OWNER_ADDRESS, PAYMASTER_TOKEN_CONFIG)
        const { fee } = await pmAccount.quoteTransfer(TRANSFER)

        expect(fee).toBe(600_000n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: TOKEN_ADDRESS, value: 0n, data: expectedData }],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })
    })

    describe('getTransactionReceipt', () => {
      test('should return the correct transaction receipt', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: DUMMY_TX_HASH })
        evmGetTransactionReceiptMock.mockResolvedValue(DUMMY_TX_RECEIPT)

        const receipt = await account.getTransactionReceipt(DUMMY_USER_OP_HASH)

        expect(receipt).toEqual(DUMMY_TX_RECEIPT)
        expect(getUserOperationByHashMock).toHaveBeenCalledWith(DUMMY_USER_OP_HASH)
        expect(evmGetTransactionReceiptMock).toHaveBeenCalledWith(DUMMY_TX_HASH)
      })

      test('should return null if the bundler has not seen the user operation yet', async () => {
        getUserOperationByHashMock.mockResolvedValue(null)

        const receipt = await account.getTransactionReceipt(DUMMY_USER_OP_HASH)

        expect(receipt).toBe(null)
      })

      test('should return null if the user operation is known but not yet included in a block', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: null })

        const receipt = await account.getTransactionReceipt(DUMMY_USER_OP_HASH)

        expect(receipt).toBe(null)
      })
    })

    describe('getTransaction', () => {
      test('throws ValueError when the hash is not a valid user operation hash', async () => {
        await expect(account.getTransaction('0xnotahash')).rejects.toThrow(ValueError)
        expect(getUserOperationByHashMock).not.toHaveBeenCalled()
      })

      test('derives finality from the bundling tx and success/fee from the user operation', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: DUMMY_TX_HASH })
        getUserOperationReceiptMock.mockResolvedValue(DUMMY_USER_OP_RECEIPT)
        evmGetTransactionMock.mockResolvedValue({ ...DUMMY_EVM_TX_INFO })

        const info = await account.getTransaction(DUMMY_USER_OP_HASH)

        expect(info.hash).toBe(DUMMY_USER_OP_HASH)
        expect(info.finality).toBe('confirmed')
        expect(info.confirmations).toBe(3)
        expect(info.success).toBe(true)
        expect(info.fee).toBe(DUMMY_USER_OP_RECEIPT.actualGasCost)
        expect(info.receipt).toEqual(DUMMY_TX_RECEIPT)
        expect(info.userOperationReceipt).toEqual(DUMMY_USER_OP_RECEIPT)
        expect(evmGetTransactionMock).toHaveBeenCalledWith(DUMMY_TX_HASH)
      })

      test('reports success false when the user operation reverted inside a successful bundling tx', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: DUMMY_TX_HASH })
        getUserOperationReceiptMock.mockResolvedValue({ ...DUMMY_USER_OP_RECEIPT, success: false })
        evmGetTransactionMock.mockResolvedValue({ ...DUMMY_EVM_TX_INFO, success: true })

        const info = await account.getTransaction(DUMMY_USER_OP_HASH)

        expect(info.success).toBe(false)
      })

      test('falls back to the tx success and fee when the user operation receipt is missing', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: DUMMY_TX_HASH })
        getUserOperationReceiptMock.mockResolvedValue(null)
        evmGetTransactionMock.mockResolvedValue({ ...DUMMY_EVM_TX_INFO })

        const info = await account.getTransaction(DUMMY_USER_OP_HASH)

        expect(info.success).toBe(DUMMY_EVM_TX_INFO.success)
        expect(info.fee).toBe(DUMMY_EVM_TX_INFO.fee)
        expect(info.userOperationReceipt).toBe(null)
      })

      test('returns pending when the user operation is known but not yet mined', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: null })

        const info = await account.getTransaction(DUMMY_USER_OP_HASH)

        expect(info.finality).toBe('pending')
        expect(info.success).toBeUndefined()
        expect(info.confirmations).toBe(0)
        expect(info.receipt).toBeNull()
        expect(info.userOperationReceipt).toBeNull()
        expect(evmGetTransactionMock).not.toHaveBeenCalled()
      })

      test('throws NoSuchElementError when the bundler has never seen the user operation', async () => {
        getUserOperationByHashMock.mockResolvedValue(null)

        await expect(account.getTransaction(DUMMY_USER_OP_HASH)).rejects.toThrow(NoSuchElementError)
        expect(evmGetTransactionMock).not.toHaveBeenCalled()
      })

      test('throws NoSuchElementError when the bundling tx can no longer be found', async () => {
        getUserOperationByHashMock.mockResolvedValue({ transactionHash: DUMMY_TX_HASH })
        getUserOperationReceiptMock.mockResolvedValue(DUMMY_USER_OP_RECEIPT)
        evmGetTransactionMock.mockRejectedValue(new NoSuchElementError(`No transaction found for '${DUMMY_TX_HASH}'.`))

        await expect(account.getTransaction(DUMMY_USER_OP_HASH)).rejects.toThrow(NoSuchElementError)
      })
    })

    describe('getUserOperationReceipt', () => {
      test('should return the user operation receipt', async () => {
        getUserOperationReceiptMock.mockResolvedValue(DUMMY_USER_OP_RECEIPT)

        const receipt = await account.getUserOperationReceipt(DUMMY_USER_OP_HASH)

        expect(receipt).toEqual(DUMMY_USER_OP_RECEIPT)
        expect(getUserOperationReceiptMock).toHaveBeenCalledWith(DUMMY_USER_OP_HASH)
      })

      test('should return null if the bundler reports no receipt', async () => {
        getUserOperationReceiptMock.mockResolvedValue(null)

        const receipt = await account.getUserOperationReceipt(DUMMY_USER_OP_HASH)

        expect(receipt).toBe(null)
      })

      test('should rethrow unexpected errors', async () => {
        getUserOperationReceiptMock.mockRejectedValue(new Error('Network failure'))

        await expect(account.getUserOperationReceipt(DUMMY_USER_OP_HASH))
          .rejects.toThrow('Network failure')
      })
    })

    describe('verify', () => {
      const MESSAGE = 'Dummy message to sign.'
      const SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

      test('should return true for a valid signature', async () => {
        verifyMock.mockResolvedValue(true)

        const result = await account.verify(MESSAGE, SIGNATURE)

        expect(result).toBe(true)
        expect(verifyMock).toHaveBeenCalledWith(MESSAGE, SIGNATURE)
        expect(WalletAccountReadOnlyEvmMock).toHaveBeenCalledWith(OWNER_ADDRESS, SPONSORED_CONFIG)
      })

      test('should return false for an invalid signature', async () => {
        verifyMock.mockResolvedValue(false)

        const result = await account.verify('wrong message', SIGNATURE)

        expect(result).toBe(false)
        expect(verifyMock).toHaveBeenCalledWith('wrong message', SIGNATURE)
      })
    })

    describe('verifyTypedData', () => {
      const TYPED_DATA = {
        domain: {
          name: 'TestApp',
          version: '1',
          chainId: 1,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
        },
        types: {
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' }
          ]
        },
        message: {
          name: 'Alice',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
        }
      }

      const TYPED_DATA_SIGNATURE = '0x1b319d2006b194b044eaff941404d39b8532de6c9a689dfa6cb03ca56fade1451ff857ea3c473cc66853e2f287a2c0ed4b7cc26de17e8b9145972c750514ac101c'

      test('should return true for a valid typed data signature', async () => {
        verifyTypedDataMock.mockResolvedValue(true)

        const result = await account.verifyTypedData(TYPED_DATA, TYPED_DATA_SIGNATURE)

        expect(result).toBe(true)
        expect(verifyTypedDataMock).toHaveBeenCalledWith(TYPED_DATA, TYPED_DATA_SIGNATURE)
      })

      test('should return false for an invalid typed data signature', async () => {
        verifyTypedDataMock.mockResolvedValue(false)

        const result = await account.verifyTypedData(TYPED_DATA, TYPED_DATA_SIGNATURE)

        expect(result).toBe(false)
        expect(verifyTypedDataMock).toHaveBeenCalledWith(TYPED_DATA, TYPED_DATA_SIGNATURE)
      })
    })
  })
})
