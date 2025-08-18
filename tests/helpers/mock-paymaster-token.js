import { ethers } from 'ethers'

// The exact token address that the mock paymaster expects
export const MOCK_PAYMASTER_TOKEN_ADDRESS = '0x68e13372AE8FAaDDaf32cC08ee44C5ef5A002c69'

/**
 * Mint tokens to a specific address using the sudoMint function
 */
export async function mintMockTokens (to, amount, signer, nonce) {
  const tokenContract = new ethers.Contract(
    MOCK_PAYMASTER_TOKEN_ADDRESS,
    ['function sudoMint(address to, uint256 amount)'],
    signer
  )

  const tx = await tokenContract.sudoMint(to, amount, { gasLimit: 100000, nonce })
  await tx.wait()
}

/**
 * Get the balance of mock tokens for an address
 */
export async function getMockTokenBalance (address, provider) {
  const tokenContract = new ethers.Contract(
    MOCK_PAYMASTER_TOKEN_ADDRESS,
    ['function balanceOf(address owner) view returns (uint256)'],
    provider
  )

  return await tokenContract.balanceOf(address)
}
