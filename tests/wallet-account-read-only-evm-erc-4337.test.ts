import { describe } from 'noba'
import { ANVIL_PROVIDER, getPaymasterAddress, getSigners, SALT_NONCE, shims } from './globalConfig'
import { WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'
import {
  erc20Abi,
  Address,
  createPublicClient,
  getContract,
  http,
  parseEther,
  toHex,
  zeroAddress,
} from 'viem'
import { base } from 'viem/chains'
import {
  entryPoint06Address,
  entryPoint07Address,
  entryPoint08Address,
} from 'viem/account-abstraction'
import { alto } from 'prool/instances'
import { erc20Address, paymaster, sudoMintTokens } from '@pimlico/mock-paymaster'
import { network } from 'hardhat'
import { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers/types'
import { createSmartAccountClient } from 'permissionless'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { prepareUserOperationForErc20Paymaster } from 'permissionless/experimental/pimlico'
import hardhatConfig from '../hardhat.config'

// const { ContractFactory, Wallet, JsonRpcProvider } = await import('ethers', {
//   with: shims,
// })

const INITIAL_TOKEN_BALANCE = parseEther('1')

describe('WalletAccountReadOnlyEvmErc4337', async ({ describe, beforeAll, afterAll }) => {
  const { networkHelpers } = await network.connect()
  let snapshot: SnapshotRestorer

  const [executor, user] = getSigners()

  const altoInstance = alto({
    port: 4337,
    entrypoints: [entryPoint06Address, entryPoint07Address, entryPoint08Address],
    rpcUrl: ANVIL_PROVIDER,
    executorPrivateKeys: [toHex(executor.getHdKey().privateKey!)],
    utilityPrivateKey: toHex(executor.getHdKey().privateKey!),
    safeMode: false,
  })
  const altoRpc = `http://${altoInstance.host}:${altoInstance.port}`

  let paymasterAddress: Address
  const paymasterInstance = paymaster({
    port: 3000,
    anvilRpc: ANVIL_PROVIDER,
    altoRpc,
  })
  const paymasterRpc = `http://${paymasterInstance.host}:${paymasterInstance.port}`

  const publicClient = createPublicClient({
    chain: base,
    transport: http(ANVIL_PROVIDER),
  })

  beforeAll(async () => {
    snapshot = await networkHelpers.takeSnapshot()

    await altoInstance.start()
    await paymasterInstance.start()

    paymasterAddress = await getPaymasterAddress(paymasterRpc)
  })

  afterAll(async () => {
    await paymasterInstance.stop()
    await altoInstance.stop()

    await snapshot.restore()
  })

  describe('fork', async ({ test }) => {
    test('should be a folked blockNumber', async ({ expect }) => {
      const blockNumber = await publicClient.getBlockNumber()
      expect(blockNumber > 0n).to.be(true)
    })

    test('should be a base chainId', async ({ expect }) => {
      const chainId = await publicClient.getChainId()
      expect(chainId).to.be(hardhatConfig.networks.base.chainId)
    })
  })

  describe('prool', async ({ test }) => {
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
      owners: [user],
      version: '1.4.1',
      threshold: 1n,
      saltNonce: BigInt(SALT_NONCE),
    })

    await sudoMintTokens({
      amount: INITIAL_TOKEN_BALANCE,
      to: smartAccount.address,
      anvilRpc: ANVIL_PROVIDER,
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
            to: zeroAddress,
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

    // test('should send a sponsored erc20 userOperation successfully', async ({ expect }) => {
    //   const smartAccountClient = createSmartAccountClient({
    //     account: smartAccount,
    //     bundlerTransport: http(altoRpc),
    //     paymaster: pimlicoClient,
    //     userOperation: {
    //       estimateFeesPerGas: async () => {
    //         const { fast } = await pimlicoClient.getUserOperationGasPrice()
    //         return fast
    //       },
    //       prepareUserOperation: prepareUserOperationForErc20Paymaster(pimlicoClient),
    //     },
    //   })

    //   const erc20 = getContract({
    //     address: erc20Address,
    //     abi: erc20Abi,
    //     client: publicClient,
    //   })

    //   const balanceBefore = await erc20.read.balanceOf([smartAccount.address])
    //   console.log(balanceBefore)
    //   expect(balanceBefore).to.equal(INITIAL_TOKEN_BALANCE)

    //   const userOpHash = await smartAccountClient.sendUserOperation({
    //     calls: [
    //       {
    //         to: zeroAddress,
    //         value: 0n,
    //         data: '0x',
    //       },
    //     ],
    //     paymasterContext: {
    //       token: erc20Address,
    //     },
    //   })

    //   const receipt = await smartAccountClient.waitForUserOperationReceipt({
    //     hash: userOpHash,
    //     timeout: 0,
    //   })
    //   expect(receipt.success).to.be(true)

    //   const balanceAfter = await erc20.read.balanceOf([smartAccount.address])
    //   expect(balanceAfter < balanceBefore).to.be(true)
    // })
  })

  describe('read', async ({ test }) => {
    const account = new WalletAccountReadOnlyEvmErc4337(user.address, {
      chainId: base.id,
      provider: ANVIL_PROVIDER,
      bundlerUrl: altoRpc,
      paymasterUrl: paymasterRpc,
      paymasterAddress,
      entryPointAddress: entryPoint07Address,
      safeModulesVersion: '0.3.0',
      paymasterToken: { address: erc20Address },
    })

    const smartAccount = await toSafeSmartAccount({
      address: (await account.getAddress()) as Address,
      client: publicClient,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
      owners: [user],
      version: '1.4.1',
      threshold: 1n,
      saltNonce: BigInt(SALT_NONCE),
    })

    await sudoMintTokens({
      amount: INITIAL_TOKEN_BALANCE,
      to: smartAccount.address,
      anvilRpc: ANVIL_PROVIDER,
    })

    test('should be valid smart account address', async ({ expect }) => {
      const address = await account.getAddress()
      expect(address).to.equal(smartAccount.address)
    })

    test('should return an empty balance', async ({ expect }) => {
      const balance = await account.getBalance()
      expect(balance).to.equal(0n)
    })

    test('should return an valid erc20 balance', async ({ expect, log }) => {
      const balance = await account.getTokenBalance(erc20Address)
      expect(balance).to.equal(INITIAL_TOKEN_BALANCE)
    })
  })
})
