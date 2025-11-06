import { describe } from 'noba'
import {
  createExtendedPublicClient,
  getPaymasterAddress,
  getSigners,
  HARDHAT_PROVIDER,
  shims,
} from './globalConfig'
import hardhatConfig from '../hardhat.config'
import type { ApproveOptions, TransferOptions } from '@tetherto/wdk-wallet-evm'
import type { Address, Hex } from 'viem'
import {
  WalletAccountEvmErc4337,
  WalletAccountReadOnlyEvmErc4337,
} from '@tetherto/wdk-wallet-evm-erc-4337'

const { encodeFunctionData, erc20Abi, http, toHex } = await import('viem', { with: shims })
const { base } = await import('viem/chains', { with: shims })
const { alto } = await import('prool/instances', { with: shims })
const { entryPoint06Address, entryPoint07Address, entryPoint08Address } = await import(
  'viem/account-abstraction',
  { with: shims }
)
const { erc20Address, paymaster, sudoMintTokens } = await import('@pimlico/mock-paymaster', {
  with: shims,
})
const { mnemonicToSeedSync } = await import('bip39', { with: shims })
const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts', { with: shims })
const { createSmartAccountClient } = await import('permissionless', { with: shims })
const { createPimlicoClient } = await import('permissionless/clients/pimlico', { with: shims })

const INITIAL_TOKEN_BALANCE = 1_000_000_000n

describe('WalletAccountEvmErc4337', async ({ describe, beforeAll, afterAll }) => {
  let account: WalletAccountEvmErc4337

  const publicClient = createExtendedPublicClient({
    chain: base,
    transport: http(HARDHAT_PROVIDER),
  })
  const snapshot = await publicClient.takeSnapshot()

  const [executor] = getSigners()
  const altoInstance = alto({
    port: 4337,
    entrypoints: [entryPoint06Address, entryPoint07Address, entryPoint08Address],
    rpcUrl: HARDHAT_PROVIDER,
    executorPrivateKeys: [toHex(executor.getHdKey().privateKey!)],
    utilityPrivateKey: toHex(executor.getHdKey().privateKey!),
    safeMode: false,
  })
  const altoRpc = `http://${altoInstance.host}:${altoInstance.port}`

  let paymasterAddress: Address
  const paymasterInstance = paymaster({
    port: 3000,
    anvilRpc: HARDHAT_PROVIDER,
    altoRpc,
  })
  // `?pimlico=true` tricks 3rd parties to detect this being pimlico url
  // https://www.npmjs.com/package/@wdk-safe-global/relay-kit?activeTab=code#:~:text=getTokenExchangeRate
  const paymasterRpc = `http://${paymasterInstance.host}:${paymasterInstance.port}?pimlico=true`

  const smartAccountClient = createSmartAccountClient({
    bundlerTransport: http(altoRpc),
    paymaster: createPimlicoClient({
      chain: base,
      transport: http(paymasterRpc),
    }),
  })

  beforeAll(async () => {
    await altoInstance.start()
    await paymasterInstance.start()

    paymasterAddress = await getPaymasterAddress(paymasterRpc)

    account = new WalletAccountEvmErc4337(hardhatConfig.networks.base.accounts.mnemonic, "0'/0/1", {
      chainId: base.id,
      provider: HARDHAT_PROVIDER,
      bundlerUrl: altoRpc,
      paymasterUrl: paymasterRpc,
      paymasterAddress,
      entryPointAddress: entryPoint07Address,
      safeModulesVersion: '0.3.0',
      paymasterToken: { address: erc20Address },
    })

    const smartAccountAddress = await account.getAddress()
    await sudoMintTokens({
      amount: INITIAL_TOKEN_BALANCE,
      to: smartAccountAddress as Address,
      anvilRpc: HARDHAT_PROVIDER,
    })
  })

  afterAll(async () => {
    await paymasterInstance.stop()
    await altoInstance.stop()

    await publicClient.restore(snapshot)
  })

  describe('constructor', async ({ test }) => {
    const PATH = "0'/0/0"
    const INVALID_PATH = "a'/b/c"

    const { mnemonic: MNEMONIC } = hardhatConfig.networks.base.accounts
    const INVALID_MNEMONIC = 'invalid mnemonic'

    const ACCOUNT = {
      index: 0,
      path: `m/44'/60'/${PATH}`,
    }

    const AA_CONFIG = {
      chainId: base.id,
      provider: HARDHAT_PROVIDER,
      bundlerUrl: altoRpc,
      paymasterUrl: paymasterRpc,
      paymasterAddress,
      entryPointAddress: entryPoint07Address,
      safeModulesVersion: '0.3.0',
      paymasterToken: { address: erc20Address },
    }

    test('should successfully initialize an account for the given mnemonic and path', async ({
      expect,
    }) => {
      const account = new WalletAccountEvmErc4337(MNEMONIC, PATH, AA_CONFIG)

      expect(account.index).to.equal(ACCOUNT.index)

      expect(account.path).to.equal(ACCOUNT.path)
    })

    test('should successfully initialize an account for the given seed and path', async ({
      expect,
    }) => {
      const account = new WalletAccountEvmErc4337(mnemonicToSeedSync(MNEMONIC), PATH, AA_CONFIG)

      expect(account.index).to.equal(ACCOUNT.index)

      expect(account.path).to.equal(ACCOUNT.path)
    })

    test('should throw if the seed phrase is invalid', async ({ expect }) => {
      expect(() => {
        new WalletAccountEvmErc4337(INVALID_MNEMONIC, PATH, AA_CONFIG)
      }).throws(/The seed phrase is invalid\./)
    })

    test('should throw if the path is invalid', async ({ expect }) => {
      expect(() => {
        new WalletAccountEvmErc4337(MNEMONIC, INVALID_PATH, AA_CONFIG)
      }).throws(/invalid path component/)
    })
  })

  describe('sign & verify', ({ describe }) => {
    const MESSAGE = 'Dummy message to sign.'
    const UNEXPECTED_MESSAGE = 'Unexpected message.'

    const EXPECTED_SIGNATURE =
      '0xb7336f2303fffc5ccde35e5ef7594f799979548f407c299d96392bf88b8372c81b18a0bc25b57697495cd48bbe3fac48150c3709ffbf8b0094db6c66abfe81231b'
    const INVALID_SIGNATURE = 'Invalid signature'

    describe('sign', async ({ test }) => {
      test('should return the correct signature', async ({ expect }) => {
        const signature = await account.sign(MESSAGE)

        expect(signature).to.equal(EXPECTED_SIGNATURE)
      })
    })

    describe('verify', async ({ test }) => {
      test('should return true for a valid signature', async ({ expect }) => {
        const result = await account.verify(MESSAGE, EXPECTED_SIGNATURE)

        expect(result).to.be(true)
      })

      test('should return false for an invalid signature', async ({ expect }) => {
        const result = await account.verify(UNEXPECTED_MESSAGE, EXPECTED_SIGNATURE)

        expect(result).to.be.falsy()
      })

      test('should throw on a malformed signature', async ({ expect }) => {
        await expect(async () => {
          await account.verify(MESSAGE, INVALID_SIGNATURE)
        }).rejects(/invalid BytesLike value/)
      })
    })
  })

  describe('sendTransaction', async ({ test }) => {
    test('should successfully send a user-op transaction', async ({ expect }) => {
      const TRANSACTION_WITH_DATA = {
        to: erc20Address,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [(await account.getAddress()) as Hex],
        }),
      }

      const { hash, fee } = await account.sendTransaction(TRANSACTION_WITH_DATA)

      expect(fee > 0n).to.be(true)

      const expected = await smartAccountClient.waitForUserOperationReceipt({
        hash: hash as Hex,
        timeout: 0,
      })
      const receipt = await account.getTransactionReceipt(hash)

      expect(hash).to.equal(expected.userOpHash)
      expect(receipt?.hash).to.equal(expected.receipt.transactionHash)
      expect(receipt?.to?.toLowerCase()).to.equal(expected.entryPoint.toLowerCase())
      expect(receipt?.status).to.equal(1)
    })

    test('should throw cause the user-op transaction with bad data', async ({ expect }) => {
      const TRANSACTION_WITH_BAD_DATA = {
        to: erc20Address,
        value: 0n,
        data: `0xbad`,
      }

      expect(async () => {
        await account.sendTransaction(TRANSACTION_WITH_BAD_DATA)
      }).rejects(/UserOperation reverted during simulation/)
    })
  })

  describe('transfer', async ({ test }) => {
    const RECIPIENT = privateKeyToAccount(generatePrivateKey())
    const AMOUNT = 1_000n

    test('should successfully transfer tokens', async ({ expect }) => {
      const TRANSACTION: TransferOptions = {
        token: erc20Address,
        recipient: RECIPIENT.address,
        amount: AMOUNT,
      }

      const { hash, fee } = await account.transfer(TRANSACTION)

      expect(fee > 0n).to.be(true)

      const expected = await smartAccountClient.waitForUserOperationReceipt({
        hash: hash as Hex,
        timeout: 0,
      })
      const receipt = await account.getTransactionReceipt(hash)

      expect(hash).to.equal(expected.userOpHash)
      expect(receipt?.hash).to.equal(expected.receipt.transactionHash)
      expect(receipt?.to?.toLowerCase()).to.equal(expected.entryPoint.toLowerCase())
      expect(receipt?.status).to.equal(1)

      const balance = await publicClient.readContract({
        address: erc20Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [RECIPIENT.address],
      })

      expect(balance).to.equal(AMOUNT)
    })
  })

  describe('approve', async ({ test }) => {
    const SPENDER = privateKeyToAccount(generatePrivateKey())
    const AMOUNT = 1_000n

    test('should successfully approve tokens', async ({ expect }) => {
      const TRANSACTION: ApproveOptions = {
        spender: SPENDER.address,
        token: erc20Address,
        amount: AMOUNT,
      }

      const { hash, fee } = await account.approve(TRANSACTION)

      expect(fee > 0n).to.be(true)

      const expected = await smartAccountClient.waitForUserOperationReceipt({
        hash: hash as Hex,
        timeout: 0,
      })
      const receipt = await account.getTransactionReceipt(hash)

      expect(hash).to.equal(expected.userOpHash)
      expect(receipt?.hash).to.equal(expected.receipt.transactionHash)
      expect(receipt?.to?.toLowerCase()).to.equal(expected.entryPoint.toLowerCase())
      expect(receipt?.status).to.equal(1)

      const balance = await publicClient.readContract({
        address: erc20Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [(await account.getAddress()) as Address, SPENDER.address],
      })

      expect(balance).to.equal(AMOUNT)
    })
  })

  describe('toReadOnlyAccount', ({ test }) => {
    test('should return a read-only copy of the account', async ({ expect }) => {
      const readOnlyAccount = await account.toReadOnlyAccount()

      expect(readOnlyAccount).to.be.instanceOf(WalletAccountReadOnlyEvmErc4337)

      expect(await readOnlyAccount.getAddress()).to.equal(await account.getAddress())
    })
  })

  describe('dispose', ({ test }) => {
    const RECIPIENT = privateKeyToAccount(generatePrivateKey())
    const AMOUNT = 1_000n

    test('should not transfer tokens after disposed', async ({ expect }) => {
      account.dispose()

      const TRANSACTION: TransferOptions = {
        token: erc20Address,
        recipient: RECIPIENT.address,
        amount: AMOUNT,
      }

      expect(async () => {
        await account.transfer(TRANSACTION)
      }).rejects(/HTTP request failed./)
    })
  })
})
