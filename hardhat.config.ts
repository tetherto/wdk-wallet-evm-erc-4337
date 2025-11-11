import { task, type HardhatUserConfig } from 'hardhat/config'
import { ArgumentType } from 'hardhat/types/arguments'
import type { HardhatPlugin } from 'hardhat/types/plugins'

import Fastify from 'fastify'
import {
  createPublicClient,
  Hex,
  Address,
  http,
  zeroAddress,
  fromHex,
} from 'viem'
import { hardhat } from 'viem/chains'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import {
  createPaymasterClient,
  entryPoint06Address,
  entryPoint07Address,
  entryPoint08Address,
} from 'viem/account-abstraction'
import { alto } from 'prool/instances'
import {
  erc20Address,
  paymaster,
  sudoMintTokens,
} from '@pimlico/mock-paymaster'
import getPort from 'get-port'

const HARDHAT_PROVIDER = 'http://localhost:8545'

const action = async ({ port }: { port: number }) => {
  // https://github.com/pimlicolabs/permissionless.js/blob/cdb8c95792101e18f6146ad1f5efa9fa0109ba63/packages/mock-paymaster/helpers/erc20-utils.ts#L42
  const PAYMASTER_UTILITY =
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const EXECUTOR = generatePrivateKey()

  let altoInstance: ReturnType<typeof alto> | null
  let paymasterInstance: ReturnType<typeof paymaster> | null

  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
      },
    },
  })

  app.get('/start', async () => {
    if (altoInstance) throw new Error('Alto already started')
    altoInstance = alto({
      port: await getPort(),
      entrypoints: [
        entryPoint06Address,
        entryPoint07Address,
        entryPoint08Address,
      ],
      rpcUrl: HARDHAT_PROVIDER,
      executorPrivateKeys: [EXECUTOR],
      utilityPrivateKey: EXECUTOR,
      safeMode: false,
    })
    const altoRpc = `http://${altoInstance.host}:${altoInstance.port}`

    if (paymasterInstance) throw new Error('Paymaster already started')
    paymasterInstance = paymaster({
      port: await getPort({ exclude: [altoInstance.port] }),
      anvilRpc: HARDHAT_PROVIDER,
      altoRpc,
    })
    // `?pimlico=true` tricks 3rd parties to detect this being pimlico url
    // https://www.npmjs.com/package/@wdk-safe-global/relay-kit?activeTab=code#:~:text=getTokenExchangeRate
    const paymasterRpc = `http://${paymasterInstance.host}:${paymasterInstance.port}?pimlico=true`

    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http(HARDHAT_PROVIDER),
    }).extend((c) => ({
      async setBalance(
        address: Address,
        amount: Hex = '0x3635c9adc5dea00000', // 1000 ETH
      ) {
        return await c.request<{
          Method: 'hardhat_setBalance'
          Params: [Hex, Hex]
          ReturnType: boolean
        }>({
          method: 'hardhat_setBalance',
          params: [address, amount],
        })
      },
    }))

    await publicClient.setBalance(privateKeyToAddress(EXECUTOR))
    await publicClient.setBalance(privateKeyToAddress(PAYMASTER_UTILITY))

    await altoInstance.start()
    await paymasterInstance.start()

    const paymasterClient = createPaymasterClient({
      transport: http(paymasterRpc),
    })

    const { paymaster: paymasterAddress } =
      await paymasterClient.getPaymasterData({
        callData: '0x',
        sender: zeroAddress,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        nonce: 0n,
        chainId: hardhat.id,
        entryPointAddress: entryPoint07Address,
      })

    if (!paymasterAddress) throw new Error('Cannot get the paymaster address')

    return { altoRpc, paymasterRpc, erc20Address, paymasterAddress }
  })

  app.get('/stop', async () => {
    if (paymasterInstance) await paymasterInstance.stop()
    paymasterInstance = null
    if (altoInstance) await altoInstance.stop()
    altoInstance = null
    return {}
  })

  app.post('/sudo-mint-tokens', async ({ body }) => {
    const { amount, to } = body as { amount: Hex; to: Address }
    await sudoMintTokens({
      amount: fromHex(amount, 'bigint'),
      to,
      anvilRpc: HARDHAT_PROVIDER,
    })
    return {}
  })

  return app.listen({ port })
}

const plugin: HardhatPlugin = {
  id: 'mock-paymaster',
  tasks: [
    task('paymaster', 'Run a mock paymaster.')
      .addOption({
        name: 'port',
        description: 'Port number.',
        type: ArgumentType.INT,
        defaultValue: 4000,
      })
      .setAction(async () => ({ default: action }))
      .build(),
  ],
}

export default {
  solidity: '0.8.24',
  networks: {
    base: {
      type: 'edr-simulated',
      chainType: 'op',
      chainId: 8453,
      accounts: {
        mnemonic:
          'anger burst story spy face pattern whale quit delay fiction ball solve',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 3,
        accountsBalance: '1000000000000000000000',
      },
      forking: {
        url: 'https://mainnet.base.org',
      },
    },
  },
  plugins: [plugin],
} satisfies HardhatUserConfig
