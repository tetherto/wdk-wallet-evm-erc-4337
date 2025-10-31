import hardhatConfig from '../hardhat.config'

import { createPublicClient, Hex, http, zeroAddress } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { createPaymasterClient, entryPoint07Address } from 'viem/account-abstraction'
import { hardhat } from 'viem/chains'

export const shims: Partial<{ imports: string }> =
  'Bare' in global ? { imports: 'bare-wdk-runtime/package' } : {}

export const HARDHAT_PROVIDER = 'http://localhost:8545'
export const ANVIL_PROVIDER = 'http://localhost:8546'

export const SALT_NONCE = '0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6'

export const getSigners = (numberOfAccounts = 3) => {
  return Array.from({ length: numberOfAccounts }).map((_, i) => {
    const { path, mnemonic } = hardhatConfig.networks.base.accounts
    return mnemonicToAccount(mnemonic, {
      path: `${path as `m/44'/60'/${string}`}/${i}`,
    })
  })
}

export const getPaymasterAddress = async (paymasterRpc: string) => {
  const client = createPaymasterClient({
    transport: http(paymasterRpc),
  })

  const { paymaster } = await client.getPaymasterData({
    callData: '0x',
    sender: zeroAddress,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    nonce: 0n,
    chainId: hardhat.id,
    entryPointAddress: entryPoint07Address,
  })

  if (!paymaster) throw new Error('Cannot get the paymaster address')

  return paymaster
}

export const createExtendedPublicClient = (...params: Parameters<typeof createPublicClient>) => {
  return createPublicClient(...params).extend((client) => ({
    async takeSnapshot() {
      const snapshotId = await client.request<{
        method: 'evm_snapshot'
        params: []
        ReturnType: Hex
      }>({ method: 'evm_snapshot', params: [] })
      return snapshotId
    },
    async restore(snapshotId: Hex) {
      const reverted = await client.request<{
        method: 'evm_revert'
        params: [string]
        ReturnType: boolean
      }>({
        method: 'evm_revert',
        params: [snapshotId],
      })
      return reverted
    },
  }))
}
