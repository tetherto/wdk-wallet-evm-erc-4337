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

import { JsonRpcProvider } from 'ethers'

import { WalletAccountReadOnly } from '@tetherto/wdk-wallet'

import { WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

import {
  // eslint-disable-next-line camelcase
  SafeAccountV0_3_0 as SafeAccount030,
  AbstractionKitError,
  Bundler,
  Erc7677Paymaster,
  HttpTransport,
  ENTRYPOINT_V7,
  calculateUserOperationMaxGasCost
} from 'abstractionkit'

/** @typedef {import('abstractionkit').InitCodeOverrides} InitCodeOverrides */
/** @typedef {import('abstractionkit').MetaTransaction} MetaTransaction */
/** @typedef {import('abstractionkit').SafeAccountV0_3_0} SafeAccountV0_3_0 */

import FailoverProvider from '@tetherto/wdk-failover-provider'

import { ConfigurationError } from './errors.js'

const PaymasterMode = {
  NATIVE: 'native',
  SPONSORED: 'sponsored',
  TOKEN: 'token'
}

export const FEE_TOLERANCE_COEFFICIENT = 120n

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */

/** @typedef {import('@tetherto/wdk-wallet-evm').TypedData} TypedData */

/** @typedef {import('abstractionkit').UserOperationReceiptResult} UserOperationReceipt */
/** @typedef {import('abstractionkit').UserOperationV7} UserOperationV7 */
/** @typedef {import('abstractionkit').TokenQuote} TokenQuote */

/**
 * @typedef {Object} BuiltUserOperation
 * @property {UserOperationV7} userOp - The fully-populated UserOperation ready to sign.
 * @property {SafeAccountV0_3_0} smartAccount - The Safe account that will execute the operation.
 * @property {'native' | 'sponsored' | 'token'} mode - The paymaster mode used to build the operation.
 * @property {bigint} chainId - The chain id captured at build time.
 * @property {TokenQuote} [tokenQuote] - The paymaster token quote, present only in token mode.
 */

/**
 * An EVM transaction shape used to build an ERC-4337 UserOperation.
 *
 * @typedef {Object} EvmErc4337Transaction
 * @property {string} to - The call's recipient.
 * @property {number | bigint} value - The amount of native coin to send to the recipient (in wei).
 * @property {string} [data] - The call's data in hex format.
 * @property {number | bigint} [callGasLimit] - If set, overrides the user operations' call gas limit.
 * @property {number | bigint} [verificationGasLimit] - If set, overrides the user operations' verification gas limit.
 * @property {number | bigint} [preVerificationGas] - If set, overrides the user operations' pre-verification gas.
 * @property {number | bigint} [maxFeePerGas] - If set, overrides the user operations' max fee per gas (EIP-1559 cap). Treated as a pair with `maxPriorityFeePerGas`: setting either disables the bundler-fetched fee fallback for both.
 * @property {number | bigint} [maxPriorityFeePerGas] - If set, overrides the user operations' max priority fee per gas. Treated as a pair with `maxFeePerGas`: setting either disables the bundler-fetched fee fallback for both.
 */

/**
 * Gas-related UserOperationV7 overrides. Numeric fields accept `number` or `bigint`; numbers are
 * coerced to `bigint` by `_extractGasOverrides` before the operation is built. All fields are
 * optional; absent fields fall back to the bundler-fetched gas price (fee pair) or the bundler's
 * gas estimation (gas limits).
 *
 * @typedef {Object} EvmErc4337GasOverrides
 * @property {number | bigint} [callGasLimit] - Override for the UserOperation's call gas limit.
 * @property {number | bigint} [verificationGasLimit] - Override for the UserOperation's verification gas limit.
 * @property {number | bigint} [preVerificationGas] - Override for the UserOperation's pre-verification gas.
 * @property {number | bigint} [maxFeePerGas] - Override for the UserOperation's max fee per gas (EIP-1559 cap).
 * @property {number | bigint} [maxPriorityFeePerGas] - Override for the UserOperation's max priority fee per gas.
 */

/**
 * A single explicit UserOperationV7 `nonce`, combined with `EvmErc4337GasOverrides` for the build
 * step to place the operation in a specific two-dimensional nonce lane. The `nonce` is derived
 * internally from the account's `parallel`/`nonceKey` configuration, never from user-supplied
 * transaction fields.
 *
 * @typedef {Object} Nonce
 * @property {number | bigint} [nonce] - Full 256-bit UserOperation nonce (`key << 64 | sequence`) placing the op in a specific lane. Omitted for default (key-0) sends, in which case the account fetches the current on-chain nonce.
 */

/**
 * @typedef {Object} OnChainIdentifier
 * @property {string} project - The project name included in the 50-byte on-chain marker.
 * @property {'Web' | 'Mobile' | 'Safe App' | 'Widget'} [platform] - The platform type (default: 'Web').
 * @property {string} [tool] - The tool name used to create the UserOperation.
 * @property {string} [toolVersion] - Semver-style tool version string included in the on-chain marker (e.g. "1.0.0").
 */

/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider | Array<string | Eip1193Provider>} provider - The url of the rpc provider, or an instance of a class that implements eip-1193. It's also possible to provide an array of urls or EIP 1193 providers instead. In such case, connection errors will cause the wallet to automatically fallback on the next provider in the list.
 * @property {number} [retries] - If set and if 'provider' is a list of urls or EIP 1193 providers, the number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order. Default: 3.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {Record<string, string>} [bundlerHeaders] - Optional HTTP headers sent on every request to the bundler (e.g. `{ Authorization: 'Bearer <key>' }`). Use for bundlers that require authentication.
 * @property {string} safeModulesVersion - Version of the Safe 4337 module set to deploy with the account (e.g. "0.3.0"). Determines the module addresses used in init code.
 * @property {OnChainIdentifier | string} [onChainIdentifier] - Optional on-chain identifier. Appends a 50-byte project marker to every UserOperation callData. Pass a string to reuse it as the project name, or a full object for more control.
 * @property {boolean} [parallel] - When true, each send is placed in a fresh, independent nonce lane (a random 192-bit key at sequence 0) so concurrent or back-to-back sends don't collide on the nonce. Ordering between such sends is not guaranteed and each consumes a new EntryPoint nonce slot. Ignored when `nonceKey` is set. Overridable per call.
 * @property {number | bigint | string} [nonceKey] - Send in an explicit nonce lane. A string is hashed to a deterministic key — a reusable named lane that resumes the same sequence across sessions; a number or bigint is used as the raw uint192 key and must be within the uint192 range (0 to 2^192 - 1), otherwise the send throws (pass a bigint or string for keys above 2^53). Sends sharing a key are ordered sequentially; different keys run in parallel. Overridable per call.
 */

/**
 * @typedef {Object} EvmErc4337WalletPaymasterTokenConfig
 * @property {false} [isSponsored] - Whether the paymaster is sponsoring the account.
 * @property {false} [useNativeCoins] - Whether to use native coins instead of a paymaster to pay for gas fees.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {Record<string, string>} [paymasterHeaders] - Optional HTTP headers sent on every request to the paymaster (e.g. `{ Authorization: 'Bearer <key>' }`). Use for paymasters that require authentication.
 * @property {string} paymasterAddress - The address of the paymaster smart contract.
 * @property {Object} paymasterToken - The paymaster token configuration.
 * @property {string} paymasterToken.address - The address of the paymaster token.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 * @property {number | bigint} [transactionMaxFee] - The maximum fee amount for sendTransaction and signTransaction operations.
 */

/**
 * @typedef {Object} EvmErc4337WalletSponsorshipPolicyConfig
 * @property {true} isSponsored - Whether the paymaster is sponsoring the account.
 * @property {false} [useNativeCoins] - Whether to use native coins instead of a paymaster to pay for gas fees.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {Record<string, string>} [paymasterHeaders] - Optional HTTP headers sent on every request to the paymaster (e.g. `{ Authorization: 'Bearer <key>' }`). Use for paymasters that require authentication.
 * @property {string} [sponsorshipPolicyId] - Identifier of the paymaster sponsorship policy to apply (provider-specific). Optional; some paymasters infer the policy from the project key.
 */

/**
 * @typedef {Object} EvmErc4337WalletNativeCoinsConfig
 * @property {false} [isSponsored] - Whether the paymaster is sponsoring the account.
 * @property {true} useNativeCoins - Whether to use native coins instead of a paymaster to pay for gas fees.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 * @property {number | bigint} [transactionMaxFee] - The maximum fee amount for sendTransaction and signTransaction operations.
 */

/**
 * @typedef {EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig)} EvmErc4337WalletConfig
 */

export const SALT_NONCE = '0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6'

const SAFE_MODULES_MAP = {
  '0.3.0': {
    safe4337ModuleAddress: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226',
    safeModuleSetupAddress: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47'
  }
}

export default class WalletAccountReadOnlyEvmErc4337 extends WalletAccountReadOnly {
  /**
   * Creates a new read-only evm [erc-4337](https://www.erc4337.io/docs) wallet account.
   *
   * @param {string} address - The evm account's address.
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} config - The configuration object.
   * @throws {ConfigurationError} If `config.safeModulesVersion` is not in the supported set.
   */
  constructor (address, config) {
    if (!SAFE_MODULES_MAP[config.safeModulesVersion]) {
      throw new ConfigurationError(`Unsupported safe modules version: ${config.safeModulesVersion}`)
    }

    const safeAddress = WalletAccountReadOnlyEvmErc4337.predictSafeAddress(address, config)

    super(safeAddress)

    /**
     * The read-only evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>}
     */
    this._config = config

    /**
     * Cached AbstractionKit bundler.
     *
     * @protected
     * @type {Bundler | undefined}
     */
    this._bundler = undefined

    /**
     * The chain id.
     *
     * @protected
     * @type {bigint | undefined}
     */
    this._chainId = undefined

    /**
     * Cached Erc7677Paymaster instances keyed by URL.
     *
     * @protected
     * @type {Map<string, Erc7677Paymaster>}
     */
    this._paymasters = new Map()

    /** @private */
    this._ownerAccountAddress = address

    /**
     * An EIP-1193–compatible provider used to interact with the blockchain.
     *
     * Note: the provider type is restricted to EIP-1193 to ensure compatibility
     * with Safe4337Pack and to enable the failover mechanism. While RPC URLs
     * can still be provided in the configuration, they are internally wrapped
     * into an EIP-1193 provider.
     *
     * @protected
     * @type {Eip1193Provider}
     */
    this._provider = this._createFailoverProvider(this._config)

    /** @private */
    this._deployedSmartAccount = undefined

    /** @private */
    this._evmReadOnlyAccount = undefined
  }

  /**
   * Predicts the address of a safe account.
   *
   * @param {string} owner - The safe owner's address.
   * @param {Pick<EvmErc4337WalletConfig, 'safeModulesVersion' | 'onChainIdentifier'>} config - The safe configuration.
   * @returns {string} The Safe address.
   */
  static predictSafeAddress (owner, config) {
    const overrides = WalletAccountReadOnlyEvmErc4337._getInitCodeOverrides(config)
    return SafeAccount030.createAccountAddress([owner], overrides)
  }

  /**
   * Returns the account's eth balance.
   *
   * @returns {Promise<bigint>} The eth balance (in weis).
   */
  async getBalance () {
    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    return await evmReadOnlyAccount.getBalance()
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<bigint>} The token balance (in base unit).
   */
  async getTokenBalance (tokenAddress) {
    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    return await evmReadOnlyAccount.getTokenBalance(tokenAddress)
  }

  /**
   * Returns the account balances for multiple tokens.
   *
   * @param {string[]} tokenAddresses - The smart contract addresses of the tokens.
   * @returns {Promise<Record<string, bigint>>} A mapping of token addresses to their balances (in base units).
   */
  async getTokenBalances (tokenAddresses) {
    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    return await evmReadOnlyAccount.getTokenBalances(tokenAddresses)
  }

  /**
   * Returns the account's balance for the paymaster token provided in the wallet account configuration.
   *
   * @returns {Promise<bigint>} The paymaster token balance (in base unit).
   * @throws {ConfigurationError} If no paymaster token is configured (sponsored or native-coins mode).
   */
  async getPaymasterTokenBalance () {
    const { paymasterToken } = this._config

    if (!paymasterToken) {
      throw new ConfigurationError('Paymaster token is not configured.')
    }

    return await this.getTokenBalance(paymasterToken.address)
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * The result is cached internally for up to 2 minutes. If `sendTransaction` is called with the
   * same transaction within that window, the cached fee is reused without an additional RPC round-trip.
   *
   * In a batched call (`tx` passed as `[tx1, tx2, ...]`), only the gas overrides on `tx1` are
   * honored — a UserOperation has a single set of gas fields regardless of how many calls it batches.
   *
   * @param {EvmErc4337Transaction | EvmErc4337Transaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
   * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
   * @throws {Error} If the token paymaster reports AA50 (account does not hold the paymaster token).
   */
  async quoteSendTransaction (tx, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    const { isSponsored } = mergedConfig

    if (isSponsored) {
      return { fee: 0n }
    }

    const gasCostResult = await this._getUserOperationGasCost([tx].flat(), mergedConfig)

    const fee = BigInt(gasCostResult.fee) * FEE_TOLERANCE_COEFFICIENT / 100n

    return { fee }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * The result is cached internally for up to 2 minutes. If `transfer` is called with the
   * same transaction within that window, the cached fee is reused without an additional RPC round-trip.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @param {EvmErc4337GasOverrides} [txOverrides] - If set, applies these UserOperationV7 gas/fee overrides to the underlying transaction.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
   * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
   * @throws {Error} If the token paymaster reports AA50 (account does not hold the paymaster token).
   */
  async quoteTransfer (options, config, txOverrides) {
    const baseTx = await WalletAccountReadOnlyEvm._getTransferTransaction(options)
    const tx = { ...baseTx, ...txOverrides }

    const result = await this.quoteSendTransaction(tx, config)

    return result
  }

  /**
   * Returns a transaction's receipt.
   *
   * @param {string} hash - The user operation hash.
   * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
   */
  async getTransactionReceipt (hash) {
    const bundler = this._getBundler()
    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    const result = await bundler.getUserOperationByHash(hash)
    if (!result || !result.transactionHash) return null

    return await evmReadOnlyAccount.getTransactionReceipt(result.transactionHash)
  }

  /**
   * Returns a user operation's receipt.
   *
   * @param {string} hash - The user operation hash.
   * @returns {Promise<UserOperationReceipt | null>} – The receipt, or null if the user operation has not been included in a block yet.
   */
  async getUserOperationReceipt (hash) {
    const bundler = this._getBundler()

    return await bundler.getUserOperationReceipt(hash)
  }

  /**
   * Returns the current allowance for the given token and spender.
   *
   * @param {string} token - The token's address.
   * @param {string} spender - The spender's address.
   * @returns {Promise<bigint>} The allowance.
   */
  async getAllowance (token, spender) {
    const readOnlyAccount = await this._getEvmReadOnlyAccount()

    return await readOnlyAccount.getAllowance(token, spender)
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify (message, signature) {
    const evmReadOnlyAccount = new WalletAccountReadOnlyEvm(this._ownerAccountAddress, this._config)
    return await evmReadOnlyAccount.verify(message, signature)
  }

  /**
   * Verifies a typed data signature.
   *
   * @param {TypedData} typedData - The typed data to verify.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verifyTypedData (typedData, signature) {
    const evmReadOnlyAccount = new WalletAccountReadOnlyEvm(this._ownerAccountAddress, this._config)

    return await evmReadOnlyAccount.verifyTypedData(typedData, signature)
  }

  /**
   * Validates the configuration to ensure all required fields are present.
   *
   * @protected
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} config - The configuration to validate.
   * @throws {ConfigurationError} If the configuration is invalid or has missing required fields.
   * @returns {void}
   */
  _validateConfig (config) {
    const { isSponsored, useNativeCoins, paymasterUrl, paymasterAddress, paymasterToken } = config
    const missingFields = []

    if (isSponsored && useNativeCoins) {
      throw new ConfigurationError("Cannot use both 'isSponsored: true' and 'useNativeCoins: true'. Please use only one.")
    }

    if (!isSponsored && !useNativeCoins) {
      if (!paymasterUrl) {
        missingFields.push('paymasterUrl')
      }
      if (!paymasterAddress) {
        missingFields.push('paymasterAddress')
      }
      if (!paymasterToken) {
        missingFields.push('paymasterToken')
      }

      if (missingFields.length > 0) {
        throw new ConfigurationError(`Missing required paymaster token configuration fields: ${missingFields.join(', ')}.`)
      }
    } else if (isSponsored) {
      if (!paymasterUrl) {
        missingFields.push('paymasterUrl')
      }

      if (missingFields.length > 0) {
        throw new ConfigurationError(`Missing required sponsorship policy configuration fields: ${missingFields.join(', ')}.`)
      }
    }
  }

  /**
   * Builds a safe account instance for the current owner.
   *
   * @protected
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The wallet configuration. Defaults to the instance configuration.
   * @returns {Promise<SafeAccountV0_3_0>} The safe account instance.
   */
  async _getSmartAccount (config = this._config) {
    if (this._deployedSmartAccount) return this._deployedSmartAccount

    const overrides = WalletAccountReadOnlyEvmErc4337._getInitCodeOverrides(config)
    const safeAddress = await this.getAddress()

    if (await SafeAccount030.isDeployed(safeAddress, this._provider)) {
      this._deployedSmartAccount = new SafeAccount030(safeAddress, overrides)
      return this._deployedSmartAccount
    }

    return SafeAccount030.initializeNewAccount([this._ownerAccountAddress], overrides)
  }

  /**
   * Builds the RPC target for an AbstractionKit client (Bundler / Erc7677Paymaster).
   *
   * When `headers` are provided, the URL is wrapped in an `HttpTransport` that injects those
   * headers on every request (e.g. `{ Authorization: 'Bearer <key>' }` for authenticated
   * bundlers/paymasters). Otherwise the plain URL string is returned, preserving AbstractionKit's
   * default transport and provider auto-detection.
   *
   * @protected
   * @param {string} url - The bundler or paymaster RPC url.
   * @param {Record<string, string>} [headers] - Optional HTTP headers to inject on every request.
   * @returns {string | HttpTransport} The url, or an HttpTransport carrying the headers.
   */
  static _rpcTarget (url, headers) {
    return headers ? new HttpTransport(url, { headers }) : url
  }

  /**
   * Returns an AbstractionKit Bundler for querying UserOperations.
   *
   * @protected
   * @returns {Bundler} The bundler.
   */
  _getBundler () {
    if (!this._bundler) {
      const rpc = WalletAccountReadOnlyEvmErc4337._rpcTarget(this._config.bundlerUrl, this._config.bundlerHeaders)
      this._bundler = new Bundler(rpc)
    }
    return this._bundler
  }

  /** @private */
  _getPaymaster (url, options = {}, headers = undefined) {
    if (!this._paymasters.has(url)) {
      const provider = WalletAccountReadOnlyEvmErc4337._detectProvider(url)
      const rpc = WalletAccountReadOnlyEvmErc4337._rpcTarget(url, headers)
      this._paymasters.set(url, new Erc7677Paymaster(rpc, { ...options, provider }))
    }
    return this._paymasters.get(url)
  }

  /**
   * Returns the chain id.
   *
   * @protected
   * @returns {Promise<bigint>} - The chain id.
   */
  async _getChainId () {
    if (!this._chainId) {
      const chainId = await this._provider.request({ method: 'eth_chainId' })

      this._chainId = BigInt(chainId)
    }

    return this._chainId
  }

  /**
   * Wraps a string RPC URL or provider into an EIP-1193 compatible provider.
   *
   * @protected
   * @param {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
   * @returns { Eip1193Provider } A wrapped Eip1193Provider instance.
   */
  _wrapEip1193Provider (provider) {
    return typeof provider === 'string'
      ? {
          provider: new JsonRpcProvider(provider),
          request ({ method, params }) {
            return this.provider.send(method, params ?? [])
          }
        }
      : provider
  }

  /**
   * Creates a FailoverProvider from the configured providers. If only one provider is supplied, it is wrapped and returned.
   *
   * @protected
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The configuration object.
   * @returns {Eip1193Provider} A wrapped Eip1193Provider instance.
   * @throws {Error} If the `provider` option is set to an empty array.
   */
  _createFailoverProvider (config = this._config) {
    const { provider, retries = 3 } = config

    if (Array.isArray(provider)) {
      if (!provider.length) {
        throw new Error("The 'provider' option cannot be set to an empty list.")
      }

      const failoverProvider = new FailoverProvider({ retries })

      for (const entry of provider) {
        const option = this._wrapEip1193Provider(entry)
        failoverProvider.addProvider(option)
      }

      return failoverProvider.initialize()
    }

    return this._wrapEip1193Provider(provider)
  }

  /** @private */
  async _getEvmReadOnlyAccount () {
    if (!this._evmReadOnlyAccount) {
      const address = await this.getAddress()
      this._evmReadOnlyAccount = new WalletAccountReadOnlyEvm(address, this._config)
    }

    return this._evmReadOnlyAccount
  }

  /**
   * Converts EVM transactions to AbstractionKit MetaTransaction calls.
   *
   * @protected
   * @param {EvmErc4337Transaction[]} txs - The transactions to convert.
   * @returns {MetaTransaction[]} The calls array for createUserOperation.
   */
  static _toMetaTransactions (txs) {
    return txs.map(tx => ({
      to: tx.to,
      value: tx.value !== undefined ? BigInt(tx.value) : 0n,
      data: tx.data ?? '0x'
    }))
  }

  /**
   * Builds the init code overrides from the wallet configuration.
   *
   * @protected
   * @param {Pick<EvmErc4337WalletConfig, 'safeModulesVersion' | 'onChainIdentifier'>} config - The wallet configuration fields used for init code generation.
   * @returns {InitCodeOverrides} The init code overrides for SafeAccount creation.
   */
  static _getInitCodeOverrides (config) {
    const { safeModulesVersion, onChainIdentifier } = config
    const modules = SAFE_MODULES_MAP[safeModulesVersion]

    const overrides = {
      c2Nonce: BigInt(SALT_NONCE),
      entrypointAddress: ENTRYPOINT_V7,
      safe4337ModuleAddress: modules.safe4337ModuleAddress,
      safeModuleSetupAddress: modules.safeModuleSetupAddress
    }

    if (onChainIdentifier) {
      overrides.onChainIdentifierParams = typeof onChainIdentifier === 'string'
        ? { project: onChainIdentifier }
        : onChainIdentifier
    }

    return overrides
  }

  /**
   * Builds a UserOperation with paymaster fields applied.
   *
   * @protected
   * @param {MetaTransaction[]} calls - The meta-transactions to include in the UserOperation.
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} config - The wallet configuration.
   * @param {EvmErc4337GasOverrides & Nonce} [txOverrides] - Optional UserOperationV7 gas overrides extracted from the input transaction(s), plus an optional explicit lane `nonce`.
   * @returns {Promise<BuiltUserOperation>} The built operation, signing context, and (in token mode) the paymaster quote.
   */
  async _buildUserOperation (calls, config, txOverrides = {}) {
    const smartAccount = await this._getSmartAccount(config)
    const chainId = await this._getChainId()

    const mode = WalletAccountReadOnlyEvmErc4337._resolvePaymasterMode(config)
    const provider = mode !== PaymasterMode.NATIVE
      ? WalletAccountReadOnlyEvmErc4337._detectProvider(config.paymasterUrl)
      : null

    const gasPrice = await this._fetchBundlerGasPrice(config.bundlerUrl)

    const feePairOverridden = txOverrides.maxFeePerGas !== undefined || txOverrides.maxPriorityFeePerGas !== undefined
    const overrides = feePairOverridden
      ? { ...txOverrides }
      : { ...gasPrice, ...txOverrides }

    const bundlerRpc = WalletAccountReadOnlyEvmErc4337._rpcTarget(config.bundlerUrl, config.bundlerHeaders)
    const baseUserOp = (mode === PaymasterMode.NATIVE || provider === 'candide')
      ? await smartAccount.createUserOperation(calls, this._provider, bundlerRpc, overrides)
      : await smartAccount.createUserOperation(calls, this._provider, undefined, { skipGasEstimation: true, ...overrides })

    if (mode === PaymasterMode.NATIVE) {
      return { userOp: baseUserOp, smartAccount, mode, chainId }
    }

    const { userOp, tokenQuote } = await this._applyPaymasterToUserOp({
      mode, smartAccount, userOp: baseUserOp, config, chainId, txOverrides
    })
    return { userOp, smartAccount, mode, chainId, tokenQuote }
  }

  /**
   * Extracts the optional UserOperationV7 gas overrides from a single transaction.
   *
   * Only the fields actually consumed by AbstractionKit's `CreateUserOperationOverrides`
   * are picked. Numeric values are coerced to bigint.
   *
   * @protected
   * @param {EvmErc4337Transaction} [tx] - The transaction to read overrides from.
   * @returns {EvmErc4337GasOverrides} The overrides object (empty if `tx` is falsy or has no override fields).
   */
  static _extractGasOverrides (tx) {
    const overrides = {}
    if (!tx) return overrides

    const fields = ['callGasLimit', 'verificationGasLimit', 'preVerificationGas', 'maxFeePerGas', 'maxPriorityFeePerGas']
    for (const field of fields) {
      if (tx[field] !== undefined) overrides[field] = BigInt(tx[field])
    }

    return overrides
  }

  /**
   * Builds a UserOperation and returns its estimated gas cost.
   *
   * Returns the cost in the paymaster token when a token quote is available, otherwise in
   * native wei. Used by `quoteSendTransaction` and reused by `sendTransaction` via the cache.
   *
   * In a batched call, only `txs[0]`'s gas overrides are honored — a UserOperation
   * carries a single set of gas fields regardless of how many calls it batches.
   *
   * @protected
   * @param {EvmErc4337Transaction[]} txs - The EVM transactions to include in the UserOperation.
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} config - The wallet configuration to use for the build.
   * @returns {Promise<BuiltUserOperation & Omit<TransactionResult, 'hash'>>} The built operation plus its raw fee (no tolerance buffer applied).
   * @throws {Error} If the token paymaster reports AA50 (account does not hold the paymaster token).
   */
  async _getUserOperationGasCost (txs, config) {
    const calls = WalletAccountReadOnlyEvmErc4337._toMetaTransactions(txs)
    const txOverrides = WalletAccountReadOnlyEvmErc4337._extractGasOverrides(txs[0])

    try {
      const buildResult = await this._buildUserOperation(calls, config, txOverrides)

      const fee = buildResult.tokenQuote
        ? buildResult.tokenQuote.tokenCost
        : calculateUserOperationMaxGasCost(buildResult.userOp)

      return { fee, ...buildResult }
    } catch (error) {
      if (error instanceof AbstractionKitError && error.message.includes('AA50')) {
        throw new Error(
          'Token paymaster requires the account to hold the paymaster token for fee estimation. ' +
          'Fund the account with the paymaster token before quoting.'
        )
      }
      throw error
    }
  }

  /** @private */
  static _resolvePaymasterMode (config) {
    if (config.useNativeCoins) return PaymasterMode.NATIVE
    if (config.isSponsored) return PaymasterMode.SPONSORED
    return PaymasterMode.TOKEN
  }

  /** @private */
  async _fetchBundlerGasPrice (bundlerUrl) {
    if (WalletAccountReadOnlyEvmErc4337._detectProvider(bundlerUrl) !== 'pimlico') return undefined

    const erc7677 = this._getPaymaster(bundlerUrl, {}, this._config.bundlerHeaders)
    const result = await erc7677.sendRPCRequest('pimlico_getUserOperationGasPrice', [])
    if (!result?.fast) return undefined

    return {
      maxFeePerGas: BigInt(result.fast.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(result.fast.maxPriorityFeePerGas)
    }
  }

  /** @private */
  static _detectProvider (url) {
    const detected = Erc7677Paymaster.detectProvider(url)
    if (detected) return detected
    if (url?.includes('pimlico')) return 'pimlico'
    if (url?.includes('candide')) return 'candide'
    return null
  }

  /** @private */
  async _applyPaymasterToUserOp ({ mode, smartAccount, userOp, config, chainId, txOverrides = {} }) {
    const erc7677 = this._getPaymaster(config.paymasterUrl, { chainId: BigInt(chainId) }, config.paymasterHeaders)

    const context = mode === PaymasterMode.TOKEN
      ? { token: config.paymasterToken.address }
      : { sponsorshipPolicyId: config.sponsorshipPolicyId }

    const paymasterOverrides = { entrypoint: ENTRYPOINT_V7 }
    if (txOverrides.callGasLimit !== undefined) paymasterOverrides.callGasLimit = txOverrides.callGasLimit
    if (txOverrides.verificationGasLimit !== undefined) paymasterOverrides.verificationGasLimit = txOverrides.verificationGasLimit
    if (txOverrides.preVerificationGas !== undefined) paymasterOverrides.preVerificationGas = txOverrides.preVerificationGas

    const bundlerRpc = WalletAccountReadOnlyEvmErc4337._rpcTarget(config.bundlerUrl, config.bundlerHeaders)
    const result = await erc7677.createPaymasterUserOperation(
      smartAccount,
      userOp,
      bundlerRpc,
      context,
      paymasterOverrides
    )

    const sponsoredOp = result.userOperation

    if (mode === PaymasterMode.TOKEN && sponsoredOp.paymaster &&
      sponsoredOp.paymaster.toLowerCase() !== config.paymasterAddress.toLowerCase()) {
      throw new ConfigurationError(
        `paymasterAddress mismatch: configured ${config.paymasterAddress} but RPC ${config.paymasterUrl} returned ${sponsoredOp.paymaster}. ` +
        'The generated ERC-20 approval would target an unexpected paymaster.'
      )
    }

    return { userOp: sponsoredOp, tokenQuote: result.tokenQuote }
  }
}
