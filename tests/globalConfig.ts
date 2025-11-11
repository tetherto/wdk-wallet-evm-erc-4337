import { detectRuntime } from 'noba'
import { type Address, type Hex } from 'viem'

const runtime = detectRuntime()

// @ts-ignore
if (runtime === 'bare') await import('bare-node-runtime/global')

export const shims: ImportAttributes =
  runtime === 'bare' ? { imports: 'bare-node-runtime/imports' } : {}

const { toHex, createPublicClient } = await import('viem', { with: shims })
const { mnemonicToAccount } = await import('viem/accounts', { with: shims })

export const HARDHAT_PROVIDER = 'http://localhost:8545'
export const MNEMONIC =
  'anger burst story spy face pattern whale quit delay fiction ball solve'
export const PATH: `m/44'/60'/${string}` = "m/44'/60'/0'/0"

export const getSigners = (numberOfAccounts = 3) => {
  return Array.from({ length: numberOfAccounts }).map((_, i) => {
    return mnemonicToAccount(MNEMONIC, {
      path: `${PATH}/${i}`,
    })
  })
}

export const initPaymaster = async (): Promise<{
  altoRpc: string
  paymasterRpc: string
  erc20Address: Address
  paymasterAddress: Address
  stopPaymaster: () => Promise<void>
  sudoMintTokens: (amount: bigint, to: Address) => Promise<void>
}> => {
  const res = await fetch('http://localhost:4545/start')
  const body = await res.json()
  return {
    ...body,
    stopPaymaster: () => fetch('http://localhost:4545/stop'),
    sudoMintTokens: async (amount: bigint, to: Address) => {
      const res = await fetch('http://localhost:4545/sudo-mint-tokens', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ amount: toHex(amount), to }),
      })
    },
  }
}

export const createExtendedPublicClient = (
  ...params: Parameters<typeof createPublicClient>
) => {
  return createPublicClient(...params).extend((client) => ({
    async takeSnapshot() {
      const snapshotId = await client.request<{
        Method: 'evm_snapshot'
        Params: []
        ReturnType: Hex
      }>({ method: 'evm_snapshot', params: [] })
      return snapshotId
    },

    async restore(snapshotId: Hex) {
      const reverted = await client.request<{
        Method: 'evm_revert'
        Params: [string]
        ReturnType: boolean
      }>({
        method: 'evm_revert',
        params: [snapshotId],
      })
      return reverted
    },
  }))
}
