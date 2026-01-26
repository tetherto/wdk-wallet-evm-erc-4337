import { describe } from 'noba'
import {
  HARDHAT_PROVIDER,
  createExtendedPublicClient,
  getSigners,
  initPaymaster,
  shims,
} from './globalConfig'
import type { Address, Hex } from 'viem'
import { WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'

const { encodeFunctionData, erc20Abi, http, zeroAddress } = await import(
  'viem',
  { with: shims }
)
const { base } = await import('viem/chains', { with: shims })
const { generatePrivateKey, privateKeyToAccount } = await import(
  'viem/accounts',
  { with: shims }
)
const { entryPoint07Address } = await import('viem/account-abstraction', {
  with: shims,
})
const { createPimlicoClient } = await import('permissionless/clients/pimlico', {
  with: shims,
})
const { toSafeSmartAccount } = await import('permissionless/accounts', {
  with: shims,
})
const { createSmartAccountClient } = await import('permissionless', {
  with: shims,
})

const INITIAL_TOKEN_BALANCE = 1_000_000_000n

describe('WalletAccountReadOnlyEvmErc4337', async ({
  describe,
  beforeAll,
  afterAll,
}) => {
  let account: WalletAccountReadOnlyEvmErc4337

  const publicClient = createExtendedPublicClient({
    chain: base,
    transport: http(HARDHAT_PROVIDER),
  })
  const snapshot = await publicClient.takeSnapshot()

  const [owner, tester] = getSigners()
  const {
    altoRpc,
    paymasterRpc,
    paymasterAddress,
    erc20Address,
    stopPaymaster,
    sudoMintTokens,
  } = await initPaymaster()

  beforeAll(async () => {
    account = new WalletAccountReadOnlyEvmErc4337(owner.address, {
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
    await sudoMintTokens(INITIAL_TOKEN_BALANCE, smartAccountAddress as Address)
  })

  afterAll(async () => {
    await stopPaymaster()
    await publicClient.restore(snapshot)
  })

  describe('getBalance', async ({ test }) => {
    test('should return the correct balance of the account', async ({
      expect,
    }) => {
      const balance = await account.getBalance()

      expect(balance).to.equal(0n)
    })

    test('should throw if the account is not connected to a provider', async ({
      expect,
    }) => {
      const account = new WalletAccountReadOnlyEvmErc4337(owner.address, {
        chainId: base.id,
        provider: '',
        bundlerUrl: altoRpc,
        paymasterUrl: paymasterRpc,
        paymasterAddress,
        entryPointAddress: entryPoint07Address,
        safeModulesVersion: '0.3.0',
        paymasterToken: { address: erc20Address },
      })

      await expect(async () => {
        await account.getBalance()
      }).rejects(
        /The wallet must be connected to a provider to retrieve balances\./,
      )
    })
  })

  describe('getPaymasterBalance', async ({ test }) => {
    test('should return the correct balance of the paymaster', async ({
      expect,
    }) => {
      const balance = await account.getPaymasterTokenBalance()

      expect(balance).to.equal(INITIAL_TOKEN_BALANCE)
    })
  })

  describe('quoteSendTransaction', async ({ test }) => {
    const RECIPIENT = privateKeyToAccount(generatePrivateKey())

    test('should successfully quote a transaction', async ({ expect }) => {
      const TRANSACTION = {
        to: RECIPIENT.address,
        value: 0,
        data: '0x',
      }

      const { fee } = await account.quoteSendTransaction(TRANSACTION)
      expect(fee > 0n).to.be(true)
    })

    test('should successfully quote a transaction with arbitrary data', async ({
      expect,
    }) => {
      const TRANSACTION_WITH_DATA = {
        to: erc20Address,
        value: 0,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [paymasterAddress],
        }),
      }

      const { fee } = await account.quoteSendTransaction(TRANSACTION_WITH_DATA)

      expect(fee > 0n).to.be(true)
    })
  })

  describe('quoteTransfer', async ({ test }) => {
    const RECIPIENT = privateKeyToAccount(generatePrivateKey())

    test('should successfully quote a transfer operation', async ({
      expect,
    }) => {
      const TRANSFER = {
        token: erc20Address,
        recipient: RECIPIENT.address,
        amount: 100,
      }

      const { fee } = await account.quoteTransfer(TRANSFER)

      expect(fee > 0n).to.be(true)
    })
  })

  describe('getTransactionReceipt', async ({ test }) => {
    const pimlicoClient = createPimlicoClient({
      chain: base,
      transport: http(paymasterRpc),
    })

    const smartAccount = await toSafeSmartAccount({
      client: publicClient,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
      owners: [tester],
      version: '1.4.1',
      threshold: 1n,
    })

    await sudoMintTokens(INITIAL_TOKEN_BALANCE, smartAccount.address)

    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      bundlerTransport: http(altoRpc),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const { fast } = await pimlicoClient.getUserOperationGasPrice()
          return fast
        },
      },
    })

    test('should return the correct transaction receipt', async ({
      expect,
    }) => {
      const TRANSACTION = {
        to: zeroAddress,
        value: 0n,
        data: '0x' as Hex,
      }

      const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [TRANSACTION],
      })

      const expected = await smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
        timeout: 0,
      })

      const receipt = await account.getTransactionReceipt(userOpHash)

      expect(receipt?.hash).to.equal(expected.receipt.transactionHash)
      expect(receipt?.to).to.equal(entryPoint07Address)
      expect(receipt?.status).to.equal(1)
    })

    test('should return the correct erc20 transaction receipt', async ({
      expect,
    }) => {
      const TRANSACTION_WITH_DATA = {
        to: erc20Address,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [paymasterAddress],
        }),
      }

      const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [TRANSACTION_WITH_DATA],
      })

      const expected = await smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
        timeout: 0,
      })

      const receipt = await account.getTransactionReceipt(userOpHash)

      expect(receipt?.hash).to.equal(expected.receipt.transactionHash)
      expect(receipt?.to).to.equal(entryPoint07Address)
      expect(receipt?.status).to.equal(1)
    })
  })
})
