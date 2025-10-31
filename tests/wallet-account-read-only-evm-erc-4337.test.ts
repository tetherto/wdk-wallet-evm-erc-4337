import { describe } from 'noba'
import { ANVIL_PROVIDER, createExtendedPublicClient, getSigners } from './globalConfig'

import { network } from 'hardhat'
import { createPublicClient, createWalletClient, Hex, http, parseEther, RpcSchema } from 'viem'
import { base } from 'viem/chains'
import { waitForTransactionReceipt } from 'viem/actions'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const INITIAL_TOKEN_BALANCE = parseEther('1')

describe('WalletAccountReadOnlyEvmErc4337', async ({ describe, beforeEach, afterEach }) => {
  const publicClient = createExtendedPublicClient({
    chain: base,
    transport: http(ANVIL_PROVIDER),
  })
  const snapshot = await publicClient.takeSnapshot()

  beforeEach(async ({ log }) => {
    console.log('beforeEach')
  })

  afterEach(async ({ log }) => {
    console.log('afterEach')
    await publicClient.restore(snapshot)
  })

  describe('network reset', async ({ test }) => {
    const receiver = privateKeyToAccount(generatePrivateKey())

    const [signer] = getSigners()
    const walletClient = createWalletClient({
      account: signer,
      chain: base,
      transport: http(ANVIL_PROVIDER),
    })

    test('#1', async ({ expect }) => {
      const txId = await walletClient.sendTransaction({
        to: receiver.address,
        value: INITIAL_TOKEN_BALANCE,
      })

      const receipt = await waitForTransactionReceipt(publicClient, { hash: txId })
      expect(receipt.status).to.be('success')

      const balance = await publicClient.getBalance({ address: receiver.address })
      expect(balance).to.be(INITIAL_TOKEN_BALANCE)
    })

    test('#2', async ({ expect }) => {
      const txId = await walletClient.sendTransaction({
        to: receiver.address,
        value: INITIAL_TOKEN_BALANCE,
      })

      const receipt = await waitForTransactionReceipt(publicClient, { hash: txId })
      expect(receipt.status).to.be('success')

      const balance = await publicClient.getBalance({ address: receiver.address })
      expect(balance).to.be(INITIAL_TOKEN_BALANCE)
    })
  })
})
