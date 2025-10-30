import { http, zeroAddress } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { createPaymasterClient, entryPoint07Address } from 'viem/account-abstraction'

import hardhatConfig from '../hardhat.config'
import { hardhat } from 'viem/chains'

export const shims: Partial<{ imports: string }> =
  'Bare' in global ? { imports: 'bare-wdk-runtime/package' } : {}

export const HARDHAT_PROVIDER = 'http://127.0.0.1:8545'
export const ANVIL_PROVIDER = 'http://127.0.0.1:8546'

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
