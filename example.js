// An example of how to initialize an account with its own safe, then create multisig with others

import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'

const wallet = new WalletManagerEvmErc4337(seedPhrase, config)

const account = await wallet.getAccount(0)
const accountAddress = await account.getAddress()
console.log('Account address:', accountAddress)

const darioAddress = '0x9f5882173b7468bc330e6c6cf2f2674666805812';
const lucaAddress = '0x42933b131078c9d5941219e80577a430b5868851';

// Ugly, we need to do this better
await account._getSafe4337Pack([accountAddress, darioAddress, lucaAddress], 2)
const familyAccountIdentifier = await account._getSafe4337PackIdentifier([accountAddress, darioAddress, lucaAddress], 2)

const familyAccountAddress = await account.getAddress(familyAccountIdentifier)

console.log('Family account address:', familyAccountAddress)

await account.transfer({
  to: accountAddress,
  amount: 1000000000000000000n,
}, null, familyAccountIdentifier) // Transfer funds from family account to yours
// This creates a UserOperation signed by you, but will need to be signed by at least 1 other signer to be executed
