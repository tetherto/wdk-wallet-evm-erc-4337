import { describe } from 'noba'
import {
  createExtendedPublicClient,
  getSigners,
  HARDHAT_PROVIDER,
  initPaymaster,
  MNEMONIC,
  shims,
} from './globalConfig'
import WalletManagerEvmErc4337, {
  WalletAccountEvmErc4337,
} from '@tetherto/wdk-wallet-evm-erc-4337'

const { base } = await import('viem/chains', { with: shims })
const { http } = await import('viem', { with: shims })
const { entryPoint07Address } = await import('viem/account-abstraction', {
  with: shims,
})
const { createSmartAccountClient } = await import('permissionless', {
  with: shims,
})
const { createPimlicoClient } = await import('permissionless/clients/pimlico', {
  with: shims,
})

describe('WalletManagerEvmErc4337', async ({
  describe,
  beforeAll,
  afterAll,
}) => {
  let wallet: WalletManagerEvmErc4337

  const publicClient = createExtendedPublicClient({
    chain: base,
    transport: http(HARDHAT_PROVIDER),
  })
  const snapshot = await publicClient.takeSnapshot()

  const [executor, owner] = getSigners()
  const {
    altoRpc,
    paymasterRpc,
    paymasterAddress,
    erc20Address,
    stopPaymaster,
  } = await initPaymaster()

  const smartAccountClient = createSmartAccountClient({
    bundlerTransport: http(altoRpc),
    paymaster: createPimlicoClient({
      chain: base,
      transport: http(paymasterRpc),
    }),
  })

  beforeAll(async () => {
    wallet = new WalletManagerEvmErc4337(MNEMONIC, {
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
    await stopPaymaster()
    await publicClient.restore(snapshot)
  })

  describe('getAccountByPath', async ({ test }) => {
    test('should return the account with the given path', async ({
      expect,
    }) => {
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

    test('should throw if the wallet is not connected to a provider', async ({
      assert,
    }) => {
      const wallet = new WalletManagerEvmErc4337(MNEMONIC, {
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
