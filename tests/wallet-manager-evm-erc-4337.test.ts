import { describe } from 'noba'
import {
  createExtendedPublicClient,
  getPaymasterAddress,
  getSigners,
  HARDHAT_PROVIDER,
} from './globalConfig'
import hardhatConfig from '../hardhat.config'

import WalletManagerEvmErc4337, { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'
import { base } from 'viem/chains'
import { Address, http, toHex } from 'viem'
import { alto } from 'prool/instances'
import {
  entryPoint06Address,
  entryPoint07Address,
  entryPoint08Address,
} from 'viem/account-abstraction'
import { erc20Address, paymaster } from '@pimlico/mock-paymaster'
import { createSmartAccountClient } from 'permissionless'
import { createPimlicoClient } from 'permissionless/clients/pimlico'

describe('WalletManagerEvmErc4337', async ({ describe, beforeAll, afterAll }) => {
  let wallet: WalletManagerEvmErc4337

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

    wallet = new WalletManagerEvmErc4337(hardhatConfig.networks.base.accounts.mnemonic, {
      chainId: base.id,
      provider: HARDHAT_PROVIDER,
      bundlerUrl: altoRpc,
      paymasterUrl: paymasterRpc,
      paymasterAddress,
      entryPointAddress: entryPoint07Address,
      safeModulesVersion: '0.3.0',
      paymasterToken: { address: erc20Address },
    })
  })

  afterAll(async () => {
    await paymasterInstance.stop()
    await altoInstance.stop()

    await publicClient.restore(snapshot)
  })

  describe('getAccountByPath', async ({ test }) => {
    test('should return the account with the given path', async ({ expect }) => {
      const account = await wallet.getAccountByPath("1'/2/3")

      expect(account).to.be.instanceOf(WalletAccountEvmErc4337)

      expect(account.path).to.equal("m/44'/60'/1'/2/3")
    })

    test('should throw if the path is invalid', async ({ expect }) => {
      await expect(async () => {
        await wallet.getAccountByPath("a'/b/c")
      }).rejects(/invalid path component/)
    })
  })

  describe('getFeeRates', async ({ test }) => {
    test('should return the correct fee rates', async ({ expect }) => {
      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal > 0n).to.be(true)
      expect(feeRates.fast > feeRates.normal).to.be(true)
    })

    test('should throw if the wallet is not connected to a provider', async ({ assert }) => {
      const wallet = new WalletManagerEvmErc4337(hardhatConfig.networks.base.accounts.mnemonic, {
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
        await wallet.getFeeRates()
      }, /The wallet must be connected to a provider to get fee rates\./)
    })
  })
})
