import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import * as bip39 from 'bip39'
import { Contract, keccak256, toUtf8Bytes } from 'ethers'
import { MaximumFeeExceededError, ProviderRequiredError, TransactionError, TransactionErrorReason, ValueError } from '@tetherto/wdk-wallet'

const actualWalletEvm = await import('@tetherto/wdk-wallet-evm')
const actualAk = await import('abstractionkit')

const getAllowanceMock = jest.fn()

const WalletAccountReadOnlyEvmMock = jest.fn().mockImplementation(() => ({
  getAllowance: getAllowanceMock
}))

Object.defineProperties(WalletAccountReadOnlyEvmMock, Object.getOwnPropertyDescriptors(actualWalletEvm.WalletAccountReadOnlyEvm))

jest.unstable_mockModule('@tetherto/wdk-wallet-evm', () => ({
  ...actualWalletEvm,
  WalletAccountReadOnlyEvm: WalletAccountReadOnlyEvmMock
}))

const isDeployedMock = jest.fn()
const createUserOperationMock = jest.fn()
const signUserOperationWithSignersMock = jest.fn()
const sendUserOperationMock = jest.fn()
const getUserOperationReceiptMock = jest.fn()
const getUserOperationByHashMock = jest.fn()
const createPaymasterUserOperationMock = jest.fn()
const sendRPCRequestMock = jest.fn()
const fetchAccountNonceMock = jest.fn()

const SafeAccountMock = jest.fn().mockImplementation((address) => ({
  accountAddress: address,
  entrypointAddress: actualAk.ENTRYPOINT_V7,
  createUserOperation: createUserOperationMock,
  signUserOperationWithSigners: signUserOperationWithSignersMock
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

const { WalletAccountEvmErc4337, ConfigurationError } = await import('../index.js')

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const INVALID_SEED_PHRASE = 'invalid seed phrase'
const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)

const ACCOUNT = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const SAFE_ADDRESS = '0x120Ac3c0B46fBAf2e8452A23BD61a2Da9B139551'

const INIT_CODE_OVERRIDES = {
  c2Nonce: BigInt('0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6'),
  entrypointAddress: actualAk.ENTRYPOINT_V7,
  safe4337ModuleAddress: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226',
  safeModuleSetupAddress: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47'
}

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const DUMMY_USER_OP_HASH = '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1'
const DUMMY_OP_SIGNATURE = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef1c'

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
  paymasterToken: { address: USDT_MAINNET_ADDRESS },
  safeModulesVersion: '0.3.0'
}

const toHex = (bytes) => Buffer.from(bytes).toString('hex')

describe('@tetherto/wdk-wallet-evm-erc-4337', () => {
  describe('WalletAccountEvmErc4337', () => {
    let account

    beforeEach(() => {
      jest.clearAllMocks()

      isDeployedMock.mockResolvedValue(true)
      createUserOperationMock.mockResolvedValue({ ...DUMMY_USER_OP })
      createPaymasterUserOperationMock.mockResolvedValue({ userOperation: { ...DUMMY_USER_OP } })
      fetchAccountNonceMock.mockResolvedValue(0n)

      account = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", SPONSORED_CONFIG)
    })

    afterEach(() => {
      account.dispose()
    })

    describe('constructor', () => {
      test('should successfully initialize an account for the given seed phrase and path', () => {
        expect(account.index).toBe(ACCOUNT.index)
        expect(account.path).toBe(ACCOUNT.path)
        expect(toHex(account.keyPair.privateKey)).toBe(ACCOUNT.keyPair.privateKey)
        expect(toHex(account.keyPair.publicKey)).toBe(ACCOUNT.keyPair.publicKey)
      })

      test('should successfully initialize an account for the given seed and path', () => {
        const acc = new WalletAccountEvmErc4337(SEED, "0'/0/0", SPONSORED_CONFIG)

        expect(acc.index).toBe(ACCOUNT.index)
        expect(acc.path).toBe(ACCOUNT.path)
        expect(toHex(acc.keyPair.privateKey)).toBe(ACCOUNT.keyPair.privateKey)
        expect(toHex(acc.keyPair.publicKey)).toBe(ACCOUNT.keyPair.publicKey)
      })

      test('should derive the safe address from the owner address', async () => {
        expect(await account.getAddress()).toBe(SAFE_ADDRESS)
      })

      test('should throw if the seed phrase is invalid', () => {
        expect(() => { new WalletAccountEvmErc4337(INVALID_SEED_PHRASE, "0'/0/0", SPONSORED_CONFIG) })
          .toThrow(ValueError)
        expect(() => { new WalletAccountEvmErc4337(INVALID_SEED_PHRASE, "0'/0/0", SPONSORED_CONFIG) })
          .toThrow('The seed phrase is invalid.')
      })

      test('should throw if the path is invalid', () => {
        expect(() => { new WalletAccountEvmErc4337(SEED_PHRASE, "a'/b/c", SPONSORED_CONFIG) })
          .toThrow('invalid path component')
      })

      test('should throw if the safe modules version is not supported', () => {
        expect(() => new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { ...SPONSORED_CONFIG, safeModulesVersion: '0.2.0' }))
          .toThrow(new ConfigurationError('Unsupported safe modules version: 0.2.0'))
      })
    })

    describe('sign', () => {
      const MESSAGE = 'Dummy message to sign.'
      const EXPECTED_SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

      test('should return the correct signature', async () => {
        const signature = await account.sign(MESSAGE)

        expect(signature).toBe(EXPECTED_SIGNATURE)
      })
    })

    describe('signTypedData', () => {
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

      const EXPECTED_TYPED_DATA_SIGNATURE = '0x1b319d2006b194b044eaff941404d39b8532de6c9a689dfa6cb03ca56fade1451ff857ea3c473cc66853e2f287a2c0ed4b7cc26de17e8b9145972c750514ac101c'

      test('should return the correct signature', async () => {
        const signature = await account.signTypedData(TYPED_DATA)

        expect(signature).toBe(EXPECTED_TYPED_DATA_SIGNATURE)
      })
    })

    describe('quoteSendTransaction', () => {
      test('should return zero fee for sponsored transactions', async () => {
        const { fee } = await account.quoteSendTransaction({ to: ACCOUNT.address, value: 1, data: '0x' })

        expect(fee).toBe(0n)
        expect(createUserOperationMock).not.toHaveBeenCalled()
      })

      test('should return the fee in paymaster token base units with the tolerance applied', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", PAYMASTER_TOKEN_CONFIG)

        const { fee } = await pmAccount.quoteSendTransaction({ to: ACCOUNT.address, value: 1, data: '0x' })

        expect(fee).toBe(600_000n)
        expect(SafeAccountMock).toHaveBeenCalledWith(SAFE_ADDRESS, INIT_CODE_OVERRIDES)
        expect(createPaymasterUserOperationMock).toHaveBeenCalledWith(
          SafeAccountMock.mock.results[0].value,
          { ...DUMMY_USER_OP },
          new actualAk.HttpTransport(PAYMASTER_TOKEN_CONFIG.bundlerUrl, {}),
          { token: USDT_MAINNET_ADDRESS },
          { entrypoint: actualAk.ENTRYPOINT_V7 }
        )
        expect(createPaymasterUserOperationMock).toHaveBeenCalledTimes(1)
      })

      test('should re-validate the merged config when a per-call override is provided', async () => {
        await expect(account.quoteSendTransaction(
          { to: ACCOUNT.address, value: 1, data: '0x' },
          { isSponsored: false }
        )).rejects.toThrow('Missing required paymaster token configuration fields: paymasterAddress, paymasterToken.')
      })
    })

    describe('sendTransaction', () => {
      const TRANSACTION = { to: ACCOUNT.address, value: 1, data: '0x' }
      const RECIPIENT = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

      test('should successfully send a sponsored transaction', async () => {
        signUserOperationWithSignersMock.mockResolvedValue(DUMMY_OP_SIGNATURE)
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const { hash, fee } = await account.sendTransaction(TRANSACTION)

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(sendUserOperationMock).toHaveBeenCalledWith(
          { ...DUMMY_USER_OP, signature: DUMMY_OP_SIGNATURE },
          actualAk.ENTRYPOINT_V7
        )
      })

      test('should successfully send a non-sponsored transaction with no prior quote', async () => {
        signUserOperationWithSignersMock.mockResolvedValue(DUMMY_OP_SIGNATURE)
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", PAYMASTER_TOKEN_CONFIG)

        const { hash, fee } = await pmAccount.sendTransaction(TRANSACTION)

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(600_000n)
        expect(sendUserOperationMock).toHaveBeenCalledWith(
          { ...DUMMY_USER_OP, signature: DUMMY_OP_SIGNATURE },
          actualAk.ENTRYPOINT_V7
        )
      })

      test('should reuse the user operation built by a previous quote for the same transaction', async () => {
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", PAYMASTER_TOKEN_CONFIG)

        const { fee: quotedFee } = await pmAccount.quoteSendTransaction(TRANSACTION)
        const { hash, fee } = await pmAccount.sendTransaction(TRANSACTION)

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(quotedFee)
        expect(createUserOperationMock).toHaveBeenCalledTimes(1)
        expect(createPaymasterUserOperationMock).toHaveBeenCalledTimes(1)
      })

      test('should throw if the fee exceeds the transaction max fee configuration', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...PAYMASTER_TOKEN_CONFIG,
          transactionMaxFee: 0n
        })

        const promise = pmAccount.sendTransaction(TRANSACTION)

        await expect(promise).rejects.toThrow(MaximumFeeExceededError)
        await expect(promise).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')

        expect(sendUserOperationMock).not.toHaveBeenCalled()
      })

      test('should allow a fee exactly equal to the transaction max fee configuration', async () => {
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...PAYMASTER_TOKEN_CONFIG,
          transactionMaxFee: 600_000n
        })

        const { hash, fee } = await pmAccount.sendTransaction(TRANSACTION)

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(600_000n)
      })

      test('should send a batch of transactions in a single user operation', async () => {
        signUserOperationWithSignersMock.mockResolvedValue(DUMMY_OP_SIGNATURE)
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const { hash, fee } = await account.sendTransaction([
          { to: ACCOUNT.address, value: 1, data: '0x' },
          { to: RECIPIENT, value: 2, data: '0xdead' }
        ])

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [
            { to: ACCOUNT.address, value: 1n, data: '0x' },
            { to: RECIPIENT, value: 2n, data: '0xdead' }
          ],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })

      test('should honor only the first transaction gas overrides in a batch', async () => {
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        await account.sendTransaction([
          { to: ACCOUNT.address, value: 1, data: '0x', callGasLimit: 111_111 },
          { to: RECIPIENT, value: 2, data: '0x', callGasLimit: 222_222 }
        ])

        expect(createUserOperationMock).toHaveBeenCalledWith(
          [
            { to: ACCOUNT.address, value: 1n, data: '0x' },
            { to: RECIPIENT, value: 2n, data: '0x' }
          ],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true, callGasLimit: 111_111n }
        )
      })

      test('should re-validate the merged config when a per-call override is provided', async () => {
        await expect(account.sendTransaction(TRANSACTION, { isSponsored: false }))
          .rejects.toThrow('Missing required paymaster token configuration fields: paymasterAddress, paymasterToken.')
      })

      test('should reframe AA50 errors from the bundler as a paymaster funds error', async () => {
        sendUserOperationMock.mockRejectedValue(
          new actualAk.AbstractionKitError('BUNDLER_ERROR', 'AA50: paymaster deposit too low')
        )

        const promise = account.sendTransaction(TRANSACTION)

        await expect(promise).rejects.toThrow(TransactionError)
        await expect(promise).rejects.toThrow('Not enough funds on the safe account to repay the paymaster.')
        await expect(promise).rejects.toMatchObject({ reason: TransactionErrorReason.INSUFFICIENT_BALANCE })
      })

      test('should reframe AA50 errors when broadcasting an already-signed user operation', async () => {
        sendUserOperationMock.mockRejectedValue(
          new actualAk.AbstractionKitError('BUNDLER_ERROR', 'AA50: paymaster deposit too low')
        )

        const promise = account.sendTransaction({ ...DUMMY_USER_OP, signature: DUMMY_OP_SIGNATURE })

        await expect(promise).rejects.toThrow(TransactionError)
        await expect(promise).rejects.toThrow('Not enough funds on the safe account to repay the paymaster.')
        await expect(promise).rejects.toMatchObject({ reason: TransactionErrorReason.INSUFFICIENT_BALANCE })
      })
    })

    describe('nonce lanes', () => {
      const TX = { to: ACCOUNT.address, value: 1, data: '0x' }
      const MAX_UINT192 = (1n << 192n) - 1n
      const MAX_UINT64 = (1n << 64n) - 1n

      beforeEach(() => {
        signUserOperationWithSignersMock.mockResolvedValue(DUMMY_OP_SIGNATURE)
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)
      })

      test('should not set a nonce override on a normal send (default key-0 path)', async () => {
        await account.sendTransaction(TX)

        expect(createUserOperationMock.mock.calls[0][3].nonce).toBeUndefined()
        expect(fetchAccountNonceMock).not.toHaveBeenCalled()
      })

      test('should place a parallel send in a fresh lane (non-zero key, sequence 0) without an on-chain nonce read', async () => {
        await account.sendTransaction(TX, { parallel: true })

        const nonce = createUserOperationMock.mock.calls[0][3].nonce
        expect(nonce >> 64n).not.toBe(0n)
        expect(nonce & MAX_UINT64).toBe(0n)
        expect(fetchAccountNonceMock).not.toHaveBeenCalled()
      })

      test('should give each parallel send its own distinct lane', async () => {
        await Promise.all([account.sendTransaction(TX, { parallel: true }), account.sendTransaction(TX, { parallel: true })])

        const keyA = createUserOperationMock.mock.calls[0][3].nonce >> 64n
        const keyB = createUserOperationMock.mock.calls[1][3].nonce >> 64n
        expect(keyA).not.toBe(keyB)
      })

      test('should use a raw bigint nonceKey verbatim, at its current sequence', async () => {
        const KEY = 42n
        const FULL_NONCE = (KEY << 64n) | 3n
        fetchAccountNonceMock.mockResolvedValue(FULL_NONCE)
        const address = await account.getAddress()

        await account.sendTransaction(TX, { nonceKey: KEY })

        expect(fetchAccountNonceMock).toHaveBeenCalledWith(expect.anything(), actualAk.ENTRYPOINT_V7, address, KEY)
        expect(createUserOperationMock.mock.calls[0][3].nonce).toBe(FULL_NONCE)
      })

      test('should accept a number nonceKey as a small raw key', async () => {
        const address = await account.getAddress()

        await account.sendTransaction(TX, { nonceKey: 7 })

        expect(fetchAccountNonceMock).toHaveBeenCalledWith(expect.anything(), actualAk.ENTRYPOINT_V7, address, 7n)
      })

      test('should derive a deterministic lane key from a string nonceKey', async () => {
        const LABEL = 'payments'
        const EXPECTED_KEY = BigInt(keccak256(toUtf8Bytes(LABEL))) & MAX_UINT192
        const address = await account.getAddress()

        await account.sendTransaction(TX, { nonceKey: LABEL })

        expect(fetchAccountNonceMock).toHaveBeenCalledWith(expect.anything(), actualAk.ENTRYPOINT_V7, address, EXPECTED_KEY)
      })

      test('should reject a bigint nonceKey above the uint192 range', async () => {
        const promise = account.sendTransaction(TX, { nonceKey: MAX_UINT192 + 1n })

        await expect(promise).rejects.toThrow(ValueError)
        await expect(promise).rejects.toThrow('nonceKey must be within the uint192 range (0 to 2^192 - 1).')

        expect(fetchAccountNonceMock).not.toHaveBeenCalled()
      })

      test('should reject a negative bigint nonceKey', async () => {
        const promise = account.sendTransaction(TX, { nonceKey: -1n })

        await expect(promise).rejects.toThrow(ValueError)
        await expect(promise).rejects.toThrow('nonceKey must be within the uint192 range (0 to 2^192 - 1).')
      })
    })

    describe('signTransaction', () => {
      const TRANSACTION = { to: ACCOUNT.address, value: 1, data: '0x' }

      test('should return the signed user operation without broadcasting it', async () => {
        signUserOperationWithSignersMock.mockResolvedValue(DUMMY_OP_SIGNATURE)

        const userOp = await account.signTransaction(TRANSACTION)

        expect(userOp).toEqual({ ...DUMMY_USER_OP, signature: DUMMY_OP_SIGNATURE })
        // The user operation is signed in place, so the recorded argument carries the signature assigned after the call.
        expect(signUserOperationWithSignersMock).toHaveBeenCalledWith(
          { ...DUMMY_USER_OP, signature: DUMMY_OP_SIGNATURE },
          [{ address: ACCOUNT.address, signHash: expect.any(Function) }],
          1n
        )
        expect(sendUserOperationMock).not.toHaveBeenCalled()
      })

      test('should throw if the fee exceeds the transaction max fee configuration', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...PAYMASTER_TOKEN_CONFIG,
          transactionMaxFee: 0n
        })

        const promise = pmAccount.signTransaction(TRANSACTION)

        await expect(promise).rejects.toThrow(MaximumFeeExceededError)
        await expect(promise).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')
      })

      test('should re-validate the merged config when a per-call override is provided', async () => {
        await expect(account.signTransaction(TRANSACTION, { isSponsored: false }))
          .rejects.toThrow('Missing required paymaster token configuration fields: paymasterAddress, paymasterToken.')
      })
    })

    describe('transfer', () => {
      const TRANSFER = {
        token: USDT_MAINNET_ADDRESS,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100n
      }

      test('should successfully transfer tokens with the sponsored flow', async () => {
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const abi = ['function transfer(address to, uint256 amount) returns (bool)']
        const contract = new Contract(USDT_MAINNET_ADDRESS, abi)
        const expectedData = contract.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

        const { hash, fee } = await account.transfer(TRANSFER)

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: USDT_MAINNET_ADDRESS, value: 0n, data: expectedData }],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })

      test('should throw if the fee exceeds the transfer max fee configuration', async () => {
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...PAYMASTER_TOKEN_CONFIG,
          transferMaxFee: 0n
        })

        const promise = pmAccount.transfer(TRANSFER)

        await expect(promise).rejects.toThrow(MaximumFeeExceededError)
        await expect(promise).rejects.toThrow('Exceeded maximum fee cost for transfer operation.')

        expect(sendUserOperationMock).not.toHaveBeenCalled()
      })

      test('should allow a fee exactly equal to the transfer max fee configuration', async () => {
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)
        createPaymasterUserOperationMock.mockResolvedValue({
          userOperation: { ...DUMMY_USER_OP },
          tokenQuote: { tokenCost: 500_000n }
        })

        const pmAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...PAYMASTER_TOKEN_CONFIG,
          transferMaxFee: 600_000n
        })

        const { hash, fee } = await pmAccount.transfer(TRANSFER)

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(600_000n)
      })

      test('should re-validate the merged config when a per-call override is provided', async () => {
        await expect(account.transfer(TRANSFER, { isSponsored: false }))
          .rejects.toThrow('Missing required paymaster token configuration fields: paymasterAddress, paymasterToken.')
      })
    })

    describe('approve', () => {
      const SPENDER = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
      const AMOUNT = 100n

      test('should throw if approving non-zero USDT on mainnet when allowance is non-zero', async () => {
        getAllowanceMock.mockResolvedValue(1n)

        const promise = account.approve({ token: USDT_MAINNET_ADDRESS, spender: SPENDER, amount: AMOUNT })

        await expect(promise).rejects.toThrow(ValueError)
        await expect(promise).rejects.toThrow('USDT requires the current allowance to be reset to 0 before setting a new non-zero value.')

        expect(getAllowanceMock).toHaveBeenCalledWith(USDT_MAINNET_ADDRESS, SPENDER)
      })

      test('should successfully approve a non-zero amount for USDT on mainnet when allowance is zero', async () => {
        getAllowanceMock.mockResolvedValue(0n)
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const abi = ['function approve(address spender, uint256 amount) returns (bool)']
        const contract = new Contract(USDT_MAINNET_ADDRESS, abi)
        const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, AMOUNT])

        const { hash, fee } = await account.approve({ token: USDT_MAINNET_ADDRESS, spender: SPENDER, amount: AMOUNT })

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: USDT_MAINNET_ADDRESS, value: 0n, data: expectedData }],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })

      test('should successfully approve a zero amount for USDT on mainnet when allowance is non-zero', async () => {
        getAllowanceMock.mockResolvedValue(1n)
        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const abi = ['function approve(address spender, uint256 amount) returns (bool)']
        const contract = new Contract(USDT_MAINNET_ADDRESS, abi)
        const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, 0])

        const { hash, fee } = await account.approve({ token: USDT_MAINNET_ADDRESS, spender: SPENDER, amount: 0 })

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: USDT_MAINNET_ADDRESS, value: 0n, data: expectedData }],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })

      test('should approve a token without checking the allowance when the token is not USDT on mainnet', async () => {
        const USDC_MAINNET_ADDRESS = '0xa0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const abi = ['function approve(address spender, uint256 amount) returns (bool)']
        const contract = new Contract(USDC_MAINNET_ADDRESS, abi)
        const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, AMOUNT])

        const { hash, fee } = await account.approve({ token: USDC_MAINNET_ADDRESS, spender: SPENDER, amount: AMOUNT })

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(getAllowanceMock).not.toHaveBeenCalled()
        expect(createUserOperationMock).toHaveBeenCalledWith(
          [{ to: USDC_MAINNET_ADDRESS, value: 0n, data: expectedData }],
          EIP1193_PROVIDER,
          undefined,
          { skipGasEstimation: true }
        )
      })

      test('should approve USDT without checking the allowance on non-mainnet chains', async () => {
        const POLYGON_PROVIDER = {
          request: jest.fn(async ({ method }) => {
            if (method === 'eth_chainId') return '0x89'
            return null
          })
        }

        sendUserOperationMock.mockResolvedValue(DUMMY_USER_OP_HASH)

        const polygonAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...SPONSORED_CONFIG,
          provider: POLYGON_PROVIDER
        })

        const { hash, fee } = await polygonAccount.approve({ token: USDT_MAINNET_ADDRESS, spender: SPENDER, amount: AMOUNT })

        expect(hash).toBe(DUMMY_USER_OP_HASH)
        expect(fee).toBe(0n)
        expect(getAllowanceMock).not.toHaveBeenCalled()
      })

      test('should throw if the account is not connected to a provider', async () => {
        const offlineAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...SPONSORED_CONFIG,
          provider: undefined
        })

        const promise = offlineAccount.approve({ token: USDT_MAINNET_ADDRESS, spender: SPENDER, amount: AMOUNT })

        await expect(promise).rejects.toThrow(ProviderRequiredError)
        await expect(promise).rejects.toThrow('The wallet must be connected to a provider to approve funds.')
      })
    })

    describe('bundler auth headers', () => {
      const BUNDLER_HEADERS = { Authorization: 'Bearer bundler-key' }

      test('should wrap the bundler url in a transport carrying the configured headers', async () => {
        getUserOperationReceiptMock.mockResolvedValue(null)

        const headersAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", {
          ...SPONSORED_CONFIG,
          bundlerHeaders: BUNDLER_HEADERS
        })
        const receipt = await headersAccount.getUserOperationReceipt(DUMMY_USER_OP_HASH)
        headersAccount.dispose()

        expect(receipt).toBe(null)
        expect(BundlerMock).toHaveBeenCalledTimes(1)
        const [transport] = BundlerMock.mock.calls[0]
        expect(transport).toBeInstanceOf(actualAk.HttpTransport)
        expect(transport.url).toBe(SPONSORED_CONFIG.bundlerUrl)
        expect(transport.options).toEqual({ headers: BUNDLER_HEADERS })
        expect(getUserOperationReceiptMock).toHaveBeenCalledWith(DUMMY_USER_OP_HASH)
      })

      test('should create the bundler transport without headers when bundlerHeaders is not configured', async () => {
        getUserOperationReceiptMock.mockResolvedValue(null)

        await account.getUserOperationReceipt(DUMMY_USER_OP_HASH)

        expect(BundlerMock).toHaveBeenCalledTimes(1)
        const [transport] = BundlerMock.mock.calls[0]
        expect(transport).toBeInstanceOf(actualAk.HttpTransport)
        expect(transport.url).toBe(SPONSORED_CONFIG.bundlerUrl)
        expect(transport.options).toEqual({})
      })
    })

    describe('toReadOnlyAccount', () => {
      test('should return a read-only copy of the account', async () => {
        const readOnlyAccount = await account.toReadOnlyAccount()

        expect(await readOnlyAccount.getAddress()).toBe(SAFE_ADDRESS)
      })
    })

    describe('dispose', () => {
      test('should dispose the wallet account and erase the private key', () => {
        const disposableAccount = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", SPONSORED_CONFIG)

        disposableAccount.dispose()

        expect(disposableAccount.keyPair.privateKey).toBeNull()
      })
    })
  })
})
