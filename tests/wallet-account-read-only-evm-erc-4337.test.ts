import { describe } from 'noba'
import {
  HARDHAT_PROVIDER,
  createExtendedPublicClient,
  getPaymasterAddress,
  getSigners,
  SALT_NONCE,
} from './globalConfig'

import { WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'
import { Address, createWalletClient, http, parseEther, toHex } from 'viem'
import { base } from 'viem/chains'
import { waitForTransactionReceipt } from 'viem/actions'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { alto } from 'prool/instances'
import {
  entryPoint06Address,
  entryPoint07Address,
  entryPoint08Address,
} from 'viem/account-abstraction'
import { erc20Address, paymaster, sudoMintTokens } from '@pimlico/mock-paymaster'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { createSmartAccountClient } from 'permissionless'

const INITIAL_TOKEN_BALANCE = parseEther('1')

describe('WalletAccountReadOnlyEvmErc4337', async ({
  describe,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
}) => {
  let account: WalletAccountReadOnlyEvmErc4337

  const publicClient = createExtendedPublicClient({
    chain: base,
    transport: http(HARDHAT_PROVIDER),
  })
  const snapshot = await publicClient.takeSnapshot()

  const [executor, owner] = getSigners()
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
  const paymasterRpc = `http://${paymasterInstance.host}:${paymasterInstance.port}`

  beforeAll(async () => {
    await altoInstance.start()
    await paymasterInstance.start()

    paymasterAddress = await getPaymasterAddress(paymasterRpc)

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

    const smartAccountAddress = (await account.getAddress()) as `0x${string}`
    await sudoMintTokens({
      amount: INITIAL_TOKEN_BALANCE,
      to: smartAccountAddress,
      anvilRpc: HARDHAT_PROVIDER,
    })
  })

  afterAll(async () => {
    await paymasterInstance.stop()
    await altoInstance.stop()

    await publicClient.restore(snapshot)
  })

  describe('getBalance', async ({ test }) => {
    test('should return the correct balance of the account', async ({ assert }) => {
      const balance = await account.getBalance()

      assert.strictEqual(balance, parseEther('0'))
    })

    test('should throw if the account is not connected to a provider', async ({ assert }) => {
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

      await assert.rejects(async () => {
        await account.getBalance()
      }, /No URL was provided to the Transport\./)
    })
  })

  describe('prool', async ({ test }) => {
    const recipient = privateKeyToAccount(generatePrivateKey())

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
      owners: [owner],
      version: '1.4.1',
      threshold: 1n,
      saltNonce: BigInt(SALT_NONCE),
    })

    test('should send a sponsored userOperation successfully', async ({ expect }) => {
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

      const userOpHash = await smartAccountClient.sendUserOperation({
        calls: [
          {
            to: recipient.address,
            value: 0n,
            data: '0x',
          },
        ],
      })

      const receipt = await smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
        timeout: 0,
      })
      expect(receipt.success).to.be(true)
    })
  })

  // describe('quoteSendTransaction', async ({ test }) => {
  //   const recipient = privateKeyToAccount(generatePrivateKey())

  //   test('should successfully quote a transaction', async ({ assert }) => {
  //     const TRANSACTION = {
  //       to: recipient.address,
  //       value: 0,
  //       data: '0x',
  //     }

  //     const { fee } = await account.quoteSendTransaction(TRANSACTION)
  //     console.log(fee)
  //   })
  // })
})
