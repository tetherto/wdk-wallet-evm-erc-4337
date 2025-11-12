import { HARDHAT_PROVIDER } from './globalConfig'

const sleep = async (ms = 1000) =>
  new Promise((resolve) => setTimeout(resolve, ms))

const checkRpcStatus = async (count = 0) => {
  const limit = 20
  if (count > limit)
    throw new Error(`Cannot setup the localnet probably after ${limit}s`)

  try {
    await sleep()
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

;(async () => {
  await checkRpcStatus()
})()
