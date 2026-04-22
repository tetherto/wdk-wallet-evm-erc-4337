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

import { WalletAccountReadOnly } from '@tetherto/wdk-wallet'

import { WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

import {
  // eslint-disable-next-line camelcase
  SafeAccountV0_3_0 as SafeAccount030,
  Bundler,
  Erc7677Paymaster,
  EOADummySignerSignaturePair,
  calculateUserOperationMaxGasCost
} from 'abstractionkit'

import { ConfigurationError } from './errors.js'

const PaymasterMode = Object.freeze({
  NATIVE: 'native',
  SPONSORED: 'sponsored',
  TOKEN: 'token'
})

const FEE_TOLERANCE_COEFFICIENT = 120n

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */

/** @typedef {import('@tetherto/wdk-wallet-evm').TypedData} TypedData */

/**
 * @typedef {Object} UserOperationReceipt
 * @property {string} userOpHash - The hash of the user operation.
 * @property {string} sender - The sender (smart account) address.
 * @property {string} nonce - The nonce used by the user operation.
 * @property {string} [paymaster] - The paymaster address, if one was used.
 * @property {bigint} actualGasCost - The actual gas cost charged (in wei).
 * @property {bigint} actualGasUsed - The actual gas units consumed.
 * @property {boolean} success - Whether the inner account execution succeeded.
 * @property {Object} receipt - The underlying transaction receipt.
 * @property {string[]} [logs] - Encoded logs emitted during execution.
 */

/**
 * @typedef {Object} CachedQuote
 * @property {bigint} fee - The estimated fee with tolerance buffer applied.
 * @property {number} createdAt - The timestamp when the quote was created.
 * @property {string} txKey - A serialized key of the transaction used for cache matching.
 */

/**
 * @typedef {Object} OnchainIdentifier
 * @property {string} project - The project name included in the 50-byte on-chain marker.
 * @property {'Web' | 'Mobile' | 'Safe App' | 'Widget'} [platform]
 * @property {string} [tool]
 * @property {string} [toolVersion]
 */

/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
 * @property {OnchainIdentifier | string} [onchainIdentifier] - Optional AbstractionKit on-chain identifier. Appends a 50-byte project marker to every UserOperation callData. Pass a string to reuse it as the project name, or a full object for more control.
 */

/**
 * @typedef {Object} EvmErc4337WalletPaymasterTokenConfig
 * @property {false} [isSponsored] - Whether the paymaster is sponsoring the account.
 * @property {false} [useNativeCoins] - Whether to use native coins instead of a paymaster to pay for gas fees.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {string} paymasterAddress - The address of the paymaster smart contract.
 * @property {Object} paymasterToken - The paymaster token configuration.
 * @property {string} paymasterToken.address - The address of the paymaster token.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 */

/**
 * @typedef {Object} EvmErc4337WalletSponsorshipPolicyConfig
 * @property {true} isSponsored - Whether the paymaster is sponsoring the account.
 * @property {false} [useNativeCoins] - Whether to use native coins instead of a paymaster to pay for gas fees.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {string} [sponsorshipPolicyId] - The sponsorship policy id.
 */

/**
 * @typedef {Object} EvmErc4337WalletNativeCoinsConfig
 * @property {false} [isSponsored] - Whether the paymaster is sponsoring the account.
 * @property {true} useNativeCoins - Whether to use native coins instead of a paymaster to pay for gas fees.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
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
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The configuration object.
   */
  constructor (address, config) {
    const safeAddress = WalletAccountReadOnlyEvmErc4337.predictSafeAddress(address, config)

    super(safeAddress)

    /**
     * The read-only evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>}
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
     * Cached quote from the last fee estimation.
     *
     * @protected
     * @type {CachedQuote | undefined}
     */
    this._lastQuote = undefined

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
     * @type {Map<string, Object>}
     */
    this._paymasters = new Map()

    /** @private */
    this._ownerAccountAddress = address
  }

  /**
   * Predicts the address of a safe account. Delegates to AbstractionKit's
   * offline CREATE2 derivation (no RPC calls).
   *
   * @param {string} owner - The safe owner's address.
   * @param {Pick<EvmErc4337WalletConfig, 'safeModulesVersion' | 'onchainIdentifier' | 'entryPointAddress'>} config - The safe configuration.
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
   */
  async getPaymasterTokenBalance () {
    const { paymasterToken } = this._config

    if (!paymasterToken) {
      throw new Error('Paymaster token is not configured.')
    }

    return await this.getTokenBalance(paymasterToken.address)
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * The result is cached internally for up to 2 minutes. If `sendTransaction` is called with the
   * same transaction within that window, the cached fee is reused without an additional RPC round-trip.
   *
   * @param {EvmTransaction | EvmTransaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
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

    const estimatedFee = await this._getUserOperationGasCost([tx].flat(), mergedConfig)

    const fee = BigInt(estimatedFee) * FEE_TOLERANCE_COEFFICIENT / 100n

    this._lastQuote = { fee, createdAt: Date.now(), txKey: WalletAccountReadOnlyEvmErc4337._getTxKey(tx) }

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
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   */
  async quoteTransfer (options, config) {
    const tx = await WalletAccountReadOnlyEvm._getTransferTransaction(options)

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

    try {
      const result = await bundler.getUserOperationByHash(hash)
      if (!result || !result.transactionHash) return null

      return await evmReadOnlyAccount.getTransactionReceipt(result.transactionHash)
    } catch {
      return null
    }
  }

  /**
   * Returns a user operation's receipt.
   *
   * @param {string} hash - The user operation hash.
   * @returns {Promise<UserOperationReceipt | null>} – The receipt, or null if the user operation has not been included in a block yet.
   */
  async getUserOperationReceipt (hash) {
    const bundler = this._getBundler()

    try {
      return await bundler.getUserOperationReceipt(hash)
    } catch {
      return null
    }
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
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The configuration to validate.
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
   * Builds an AbstractionKit SafeAccountV0_3_0 instance for the current owner.
   * Omits factoryAddress/factoryData when the account is already deployed, so
   * subsequent UserOperations don't try to redeploy it (which would revert at
   * the EntryPoint).
   *
   * @protected
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config]
   * @returns {Promise<object>} The AbstractionKit SafeAccountV0_3_0 instance.
   */
  async _getSmartAccount (config = this._config) {
    const overrides = WalletAccountReadOnlyEvmErc4337._getInitCodeOverrides(config)
    const safeAddress = await this.getAddress()

    if (await this._isAccountDeployed(safeAddress)) {
      return new SafeAccount030(safeAddress, overrides)
    }

    return SafeAccount030.initializeNewAccount([this._ownerAccountAddress], overrides)
  }

  /**
   * Checks whether the Safe account has already been deployed.
   *
   * @protected
   * @param {string} address
   * @returns {Promise<boolean>}
   */
  async _isAccountDeployed (address) {
    if (this._deployed) return true

    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()
    const code = await evmReadOnlyAccount._provider.getCode(address)
    const deployed = code !== '0x' && code !== '0x0'

    if (deployed) this._deployed = true

    return deployed
  }

  /**
   * Returns an AbstractionKit Bundler for querying UserOperations.
   *
   * @protected
   * @returns {Bundler} The bundler.
   */
  _getBundler () {
    if (!this._bundler) {
      this._bundler = new Bundler(this._config.bundlerUrl)
    }
    return this._bundler
  }

  /** @private */
  _getPaymaster (url, options = {}) {
    if (!this._paymasters.has(url)) {
      const provider = WalletAccountReadOnlyEvmErc4337._detectProvider(url)
      this._paymasters.set(url, new Erc7677Paymaster(url, { ...options, provider }))
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
      const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

      const { chainId } = await evmReadOnlyAccount._provider.getNetwork()

      this._chainId = chainId
    }

    return this._chainId
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
   * Returns a serialized key for transaction cache matching.
   *
   * @protected
   * @param {EvmTransaction | EvmTransaction[]} tx - The transaction(s) to serialize.
   * @returns {string} The serialized transaction key.
   */
  static _getTxKey (tx) {
    return JSON.stringify([tx].flat(), (_, v) => typeof v === 'bigint' ? v.toString() : v)
  }

  /**
   * Converts EVM transactions to AbstractionKit MetaTransaction calls.
   *
   * @protected
   * @param {EvmTransaction[]} txs - The transactions to convert.
   * @returns {Object[]} The calls array for createUserOperation.
   */
  static _toCalls (txs) {
    return txs.map(tx => ({
      to: tx.to,
      value: tx.value !== undefined ? BigInt(tx.value) : 0n,
      data: tx.data ?? '0x'
    }))
  }

  /**
   * Builds AbstractionKit InitCodeOverrides from the wallet configuration.
   *
   * @protected
   * @param {Partial<EvmErc4337WalletConfig>} config
   * @returns {object}
   */
  static _getInitCodeOverrides (config) {
    const { safeModulesVersion, entryPointAddress, onchainIdentifier } = config
    const modules = SAFE_MODULES_MAP[safeModulesVersion]
    if (!modules) {
      throw new Error(`Unsupported safe modules version: ${safeModulesVersion}`)
    }

    const overrides = {
      c2Nonce: BigInt(SALT_NONCE),
      safe4337ModuleAddress: modules.safe4337ModuleAddress,
      safeModuleSetupAddress: modules.safeModuleSetupAddress
    }

    if (entryPointAddress) {
      overrides.entrypointAddress = entryPointAddress
    }

    if (onchainIdentifier) {
      overrides.onChainIdentifierParams = typeof onchainIdentifier === 'string'
        ? { project: onchainIdentifier }
        : onchainIdentifier
    }

    return overrides
  }

  /**
   * Builds a UserOperation via AbstractionKit with paymaster fields applied.
   * Shared by gas quoting (read-only) and sending (full-access).
   *
   * - Native: full AK estimation via the bundler.
   * - Candide paymaster: full AK estimation first (their bundler requires
   *   gas headroom from double-estimation), then Erc7677Paymaster.
   * - Pimlico / other ERC-7677: skip initial estimation (bundlers reject
   *   prefund check without paymaster), let Erc7677Paymaster drive
   *   estimation with paymaster attached.
   *
   * @protected
   * @param {object[]} calls
   * @param {object} config
   * @returns {Promise<object>} The fully-populated UserOperation ready to sign.
   */
  async _buildUserOperation (calls, config) {
    const smartAccount = await this._getSmartAccount(config)
    const chainId = await this._getChainId()

    const mode = WalletAccountReadOnlyEvmErc4337._resolvePaymasterMode(config)
    const providerRpc = typeof config.provider === 'string' ? config.provider : undefined
    const provider = mode !== PaymasterMode.NATIVE
      ? WalletAccountReadOnlyEvmErc4337._detectProvider(config.paymasterUrl)
      : null

    if (mode === PaymasterMode.NATIVE || provider === 'candide') {
      const gasPrice = await this._fetchBundlerGasPrice(config.bundlerUrl)
      const baseUserOp = await smartAccount.createUserOperation(
        calls,
        providerRpc,
        config.bundlerUrl,
        gasPrice
      )

      if (mode === PaymasterMode.NATIVE) {
        return { userOp: baseUserOp, smartAccount, mode, chainId }
      }

      const userOp = await this._applyPaymasterToUserOp({
        mode, smartAccount, userOp: baseUserOp, config, chainId
      })
      return { userOp, smartAccount, mode, chainId }
    }

    const gasPrice = await this._fetchBundlerGasPrice(config.bundlerUrl)
    const baseUserOp = await smartAccount.createUserOperation(
      calls,
      providerRpc,
      undefined,
      { callGasLimit: 0n, verificationGasLimit: 0n, preVerificationGas: 0n, ...gasPrice }
    )

    const userOp = await this._applyPaymasterToUserOp({
      mode, smartAccount, userOp: baseUserOp, config, chainId
    })

    return { userOp, smartAccount, mode, chainId }
  }

  /** @private */
  async _getUserOperationGasCost (txs, config) {
    const calls = WalletAccountReadOnlyEvmErc4337._toCalls(txs)

    try {
      const { userOp } = await this._buildUserOperation(calls, config)

      const gasCostWei = calculateUserOperationMaxGasCost(userOp)
      const mode = WalletAccountReadOnlyEvmErc4337._resolvePaymasterMode(config)

      if (mode !== PaymasterMode.TOKEN) {
        return gasCostWei
      }

      const chainId = await this._getChainId()
      const erc7677 = this._getPaymaster(config.paymasterUrl, { chainId })
      const chainIdHex = `0x${chainId.toString(16)}`
      const entrypoint = config.entryPointAddress

      let exchangeRate
      if (WalletAccountReadOnlyEvmErc4337._detectProvider(config.paymasterUrl) === 'pimlico') {
        const result = await erc7677.sendRPCRequest('pimlico_getTokenQuotes', [
          { tokens: [config.paymasterToken.address] },
          entrypoint,
          chainIdHex
        ])
        const rate = result?.quotes?.[0]?.exchangeRate
        if (rate === undefined) {
          throw new Error(`Token ${config.paymasterToken.address} is not supported by the paymaster.`)
        }
        exchangeRate = BigInt(rate)
      } else {
        const result = await erc7677.sendRPCRequest('pm_supportedERC20Tokens', [entrypoint])
        const token = result?.tokens?.find(
          t => t.address.toLowerCase() === config.paymasterToken.address.toLowerCase()
        )
        if (token?.exchangeRate === undefined) {
          throw new Error(`Token ${config.paymasterToken.address} is not supported by the paymaster.`)
        }
        exchangeRate = BigInt(token.exchangeRate)
      }

      return (gasCostWei * exchangeRate + (10n ** 18n - 1n)) / (10n ** 18n)
    } catch (error) {
      if (error.message?.includes('AA50')) {
        throw new Error('Simulation failed: not enough funds in the safe account to repay the paymaster.')
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

    const erc7677 = this._getPaymaster(bundlerUrl)
    const result = await erc7677.sendRPCRequest('pimlico_getUserOperationGasPrice', [])
    if (!result?.fast) return undefined

    return {
      maxFeePerGas: BigInt(result.fast.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(result.fast.maxPriorityFeePerGas)
    }
  }

  /** @private */
  static _detectProvider (url) {
    return Erc7677Paymaster.detectProvider(url) ||
      (url?.includes('pimlico') ? 'pimlico' : url?.includes('candide') ? 'candide' : null)
  }

  /** @private */
  async _applyPaymasterToUserOp ({ mode, smartAccount, userOp, config, chainId }) {
    if (mode === PaymasterMode.NATIVE) return userOp

    if (!userOp.signature || userOp.signature.length < 3) {
      userOp.signature = SafeAccount030.formatSignaturesToUseroperationSignature(
        [EOADummySignerSignaturePair], {}
      )
    }

    const erc7677 = this._getPaymaster(config.paymasterUrl, { chainId: BigInt(chainId) })

    const context = mode === PaymasterMode.TOKEN
      ? { token: config.paymasterToken.address }
      : (config.sponsorshipPolicyId ? { sponsorshipPolicyId: config.sponsorshipPolicyId } : {})

    return await erc7677.createPaymasterUserOperation(
      smartAccount,
      userOp,
      config.bundlerUrl,
      context,
      { entrypoint: config.entryPointAddress }
    )
  }
}
