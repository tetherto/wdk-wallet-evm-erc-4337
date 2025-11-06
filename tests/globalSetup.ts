import { setTimeout } from 'timers/promises'
import { HARDHAT_PROVIDER, shims } from './globalConfig'

const { privateKeyToAccount } = await import('viem/accounts', { with: shims })

const checkRpcStatus = async (count = 0) => {
  const limit = 20
  if (count > limit) throw new Error(`Cannot setup the localnet probably after ${limit}s`)

  try {
    await setTimeout(1000)
    const res = await fetch(HARDHAT_PROVIDER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    })
    if (res.ok) return true
    return await checkRpcStatus(++count)
  } catch {
    return await checkRpcStatus(++count)
  }
}

const setPaymasterUtilityBalance = async () => {
  // https://github.com/pimlicolabs/permissionless.js/blob/cdb8c95792101e18f6146ad1f5efa9fa0109ba63/packages/mock-paymaster/helpers/erc20-utils.ts#L42
  const account = privateKeyToAccount(
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  )
  await fetch(HARDHAT_PROVIDER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'hardhat_setBalance',
      params: [
        account.address,
        '0x3635c9adc5dea00000', // 1000 ETH
      ],
      id: 2,
    }),
  })
}

;(async () => {
  await checkRpcStatus()
  await setPaymasterUtilityBalance()
})()
