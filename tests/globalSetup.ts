import { ANVIL_PROVIDER } from './globalConfig'

const sleep = async (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms))

const checkRpcStatus = async (count = 0) => {
  if (count > 10) throw new Error('Cannot setup the localnet probably after 10s')

  try {
    await sleep()
    const res = await fetch(ANVIL_PROVIDER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    })
    if (res.ok) return ANVIL_PROVIDER
    return await checkRpcStatus(++count)
  } catch {
    return await checkRpcStatus(++count)
  }
}

;(async () => {
  await checkRpcStatus()
})()
