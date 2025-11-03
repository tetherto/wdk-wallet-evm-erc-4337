import { describe } from 'noba'
import {
  HARDHAT_PROVIDER,
  createExtendedPublicClient,
  getPaymasterAddress,
  getSigners,
  SALT_NONCE,
} from './globalConfig'

import { WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'
import {
  Address,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  getContract,
  http,
  parseEther,
  toHex,
} from 'viem'
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
  // `?pimlico=true` tricks 3rd parties to detect this being pimlico url
  // https://www.npmjs.com/package/@wdk-safe-global/relay-kit?activeTab=code#:~:text=getTokenExchangeRate
  const paymasterRpc = `http://${paymasterInstance.host}:${paymasterInstance.port}?pimlico=true`

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
    test('should return the correct balance of the account', async ({ expect }) => {
      const balance = await account.getBalance()

      expect(balance).to.equal(parseEther('0'))
    })

    test('should throw if the account is not connected to a provider', async ({ expect }) => {
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
      }).rejects(/No URL was provided to the Transport\./)
    })
  })

  describe('getPaymasterBalance', async ({ test }) => {
    test('should return the correct balance of the paymaster', async ({ expect }) => {
      const balance = await account.getPaymasterTokenBalance()

      expect(balance).to.equal(1000000000000000000n)
    })
  })

  describe('quoteSendTransaction', async ({ test }) => {
    const recipient = privateKeyToAccount(generatePrivateKey())

    test('should successfully quote a transaction', async ({ expect }) => {
      const TRANSACTION = {
        to: recipient.address,
        value: 0,
        data: '0x',
      }

      const { fee } = await account.quoteSendTransaction(TRANSACTION)
      expect(fee > 0n).to.be(true)
    })

    test('should successfully quote a transaction with arbitrary data', async ({ expect }) => {
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
})
