// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').UserOperationReceipt} UserOperationReceipt */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').BuiltUserOperation} BuiltUserOperation */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337TransactionDetails} EvmErc4337TransactionDetails */

/** @typedef {import('@tetherto/wdk-wallet').Finality} Finality */
/** @typedef {import('@tetherto/wdk-wallet').TransactionReceipt} TransactionReceipt */
/** @typedef {import('@tetherto/wdk-wallet').WaitForTransactionTarget} WaitForTransactionTarget */
/** @typedef {import('@tetherto/wdk-wallet').WaitForTransactionOptions} WaitForTransactionOptions */

/** @typedef {import('@tetherto/wdk-wallet-evm').FeeRates} FeeRates */

/** @typedef {import('@tetherto/wdk-wallet-evm').KeyPair} KeyPair */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337Transaction} EvmErc4337Transaction */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337GasOverrides} EvmErc4337GasOverrides */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337TransferOptions} EvmErc4337TransferOptions */
/** @typedef {import('./src/wallet-account-evm-erc-4337.js').EvmErc4337ApproveOptions} EvmErc4337ApproveOptions */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').Nonce} Nonce */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */
/** @typedef {import('@tetherto/wdk-wallet-evm').ApproveOptions} ApproveOptions */

/** @typedef {import('@tetherto/wdk-wallet-evm').TypedData} TypedData */
/** @typedef {import('@tetherto/wdk-wallet-evm').TypedDataDomain} TypedDataDomain */
/** @typedef {import('@tetherto/wdk-wallet-evm').TypedDataField} TypedDataField */

/** @typedef {import('./src/wallet-manager-evm-erc-4337.js').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletCommonConfig} EvmErc4337WalletCommonConfig */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletPaymasterTokenConfig} EvmErc4337WalletPaymasterTokenConfig */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletSponsorshipPolicyConfig} EvmErc4337WalletSponsorshipPolicyConfig */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletNativeCoinsConfig} EvmErc4337WalletNativeCoinsConfig */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').OnChainIdentifier} OnChainIdentifier */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').SafeAccountV0_3_0} SafeAccountV0_3_0 */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').UserOperationV7} UserOperationV7 */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').TokenQuote} TokenQuote */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').MetaTransaction} MetaTransaction */
/** @typedef {import('./src/wallet-account-read-only-evm-erc-4337.js').InitCodeOverrides} InitCodeOverrides */

export { default } from './src/wallet-manager-evm-erc-4337.js'

export { default as WalletAccountReadOnlyEvmErc4337 } from './src/wallet-account-read-only-evm-erc-4337.js'

export { default as WalletAccountEvmErc4337 } from './src/wallet-account-evm-erc-4337.js'

export { ConfigurationError } from './src/errors.js'
