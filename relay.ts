import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.all('*', async ({ req }) => {
  const rpc = await req.json<{
    jsonrpc: '2.0'
    id: number
    method: string
    params: any[]
  }>()
  if (rpc.method === 'anvil_setBalance') rpc.method = 'hardhat_setBalance'
  return await fetch(`http://127.0.0.1:8545${req.path}`, {
    method: req.method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(rpc),
  })
})

serve({ fetch: app.fetch, port: 8546 }, ({ port }) => {
  console.log(`Proxy running on ${port} → 8545`)
})
