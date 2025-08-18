/**
 * Helper function to discover paymaster address using ERC-7677 standard
 * @param {string} paymasterUrl - The paymaster service URL
 * @param {string} tokenAddress - The token address to use for paymaster
 * @returns {Promise<string>} The discovered paymaster address
 */
export async function discoverPaymasterAddress (paymasterUrl, entryPoint, tokenAddress) {
  const response = await fetch(paymasterUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterData',
      params: [
        {
          sender: '0x0000000000000000000000000000000000000001',
          nonce: '0x0',
          factory: null,
          factoryData: null,
          callData: '0x',
          callGasLimit: '0x0',
          verificationGasLimit: '0x0',
          preVerificationGas: '0x0',
          maxFeePerGas: '0x0',
          maxPriorityFeePerGas: '0x0',
          paymaster: null,
          paymasterVerificationGasLimit: null,
          paymasterPostOpGasLimit: null,
          paymasterData: null,
          signature: '0x'
        },
        entryPoint,
        1,
        {
          token: tokenAddress
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Paymaster service error: ${data.error.message}`)
  }

  if (!data.result || !data.result.paymaster) {
    throw new Error('No paymaster address found in response')
  }

  const paymasterAddress = data.result.paymaster

  return paymasterAddress
}
