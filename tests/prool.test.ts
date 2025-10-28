import { describe } from 'noba'
import { HDNodeWallet } from 'ethers'
import { alto } from 'prool/instances'
import { paymaster } from '@pimlico/mock-paymaster'
import { createSmartAccountClient } from 'permissionless'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { createPublicClient, http, zeroAddress } from 'viem'
import {
  entryPoint06Address,
  entryPoint07Address,
  entryPoint08Address,
} from 'viem/account-abstraction'
import { foundry } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import hardhatConfig from '../hardhat.config'

const PROVIDER = 'http://127.0.0.1:8546'

const getSigners = () => {
  const hd = HDNodeWallet.fromPhrase(
    hardhatConfig.networks.localnet.accounts.mnemonic,
    undefined,
    hardhatConfig.networks.localnet.accounts.path,
  )
  return Array.from({ length: 3 }).map((_, i) => hd.deriveChild(i))
}

describe('erc4337 with prool', async ({ beforeAll, afterAll, test }) => {
  const [executor] = getSigners()

  const altoInstance = alto({
    port: 4337,
    entrypoints: [entryPoint06Address, entryPoint07Address, entryPoint08Address],
    rpcUrl: PROVIDER,
    executorPrivateKeys: [executor.privateKey] as Array<`0x${string}`>,
    utilityPrivateKey: executor.privateKey,
    safeMode: false,
  })
  const altoRpc = `http://${altoInstance.host}:${altoInstance.port}`

  const paymasterInstance = paymaster({
    port: 3000,
    anvilRpc: PROVIDER,
    altoRpc,
  })
  const paymasterRpc = `http://${paymasterInstance.host}:${paymasterInstance.port}`

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(PROVIDER),
  })

  beforeAll(async () => {
    await altoInstance.start()
    await paymasterInstance.start()
  })

  afterAll(async () => {
    await paymasterInstance.stop()
    await altoInstance.stop()
  })

  test('should create an instance successfully', async ({ expect }) => {
    const blockNumber = await publicClient.getBlockNumber()
    expect(blockNumber > 0).to.be(true)
  })

  test('should send a sponsored userOperation successfully', async ({ expect }) => {
    const pimlicoClient = createPimlicoClient({
      chain: foundry,
      transport: http(paymasterRpc),
    })

    const account = await toSimpleSmartAccount({
      client: publicClient,
      owner: privateKeyToAccount(generatePrivateKey()),
    })

    const smartAccountClient = createSmartAccountClient({
      account,
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
})
