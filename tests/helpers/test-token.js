import { ContractFactory } from 'ethers'
import fs from 'fs'
import path from 'path'

// Load TestToken ABI and bytecode
const artifactPath = path.join(process.cwd(), 'tests/artifacts/TestToken.json')
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
export const TEST_TOKEN_ABI = artifact.abi
export const TEST_TOKEN_BYTECODE = artifact.bytecode

/**
 * Deploys the TestToken contract.
 * @param {ethers.Wallet} deployer - The wallet to deploy the contract.
 * @returns {Promise<ethers.Contract>} The deployed contract instance.
 */
export async function deploy (deployer) {
  const factory = new ContractFactory(TEST_TOKEN_ABI, TEST_TOKEN_BYTECODE, deployer)
  const contract = await factory.deploy()
  await contract.waitForDeployment()
  return contract
}

/**
 * Transfers tokens from the signer to the recipient.
 * @param {ethers.Contract} token - The ERC20 contract instance.
 * @param {string} to - The recipient address.
 * @param {ethers.BigNumberish} amount - The amount to transfer.
 * @param {ethers.Wallet} signer - The wallet to sign the transaction.
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export async function transfer (token, to, amount, signer, nonce) {
  const tokenWithSigner = token.connect(signer)
  const tx = await tokenWithSigner.transfer(to, amount, { nonce })
  return await tx.wait()
}

/**
 * Gets the token balance of an address.
 * @param {ethers.Contract} token - The ERC20 contract instance.
 * @param {string} address - The address to check.
 * @returns {Promise<ethers.BigNumber>}
 */
export async function balanceOf (token, address) {
  return await token.balanceOf(address)
}
