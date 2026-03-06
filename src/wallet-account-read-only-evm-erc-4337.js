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

import { Safe4337Pack, GenericFeeEstimator, PimlicoFeeEstimator } from '@tetherto/wdk-safe-relay-kit'

import FailoverProvider from '@tetherto/wdk-failover-provider'

import { ConfigurationError } from './errors.js'

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@tetherto/wdk-safe-relay-kit').UserOperationReceipt} UserOperationReceipt */

/** @typedef {import('@tetherto/wdk-safe-relay-kit').IFeeEstimator} IFeeEstimator */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */

/** @typedef {import('@tetherto/wdk-wallet-evm').TypedData} TypedData */

/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider | Array<string | Eip1193Provider>} provider - The url of the rpc provider, or an instance of a class that implements eip-1193. If it's a list of urls or instances, the provider failover strategy will be enabled.
 * @property {number} [retries] - The number of retries in the failover mechanism.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
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
     * Map of Safe4337Pack instances cached by configuration.
     *
     * @protected
     * @type {Map<string, Safe4337Pack>}
     */
    this._safe4337Packs = new Map()

    /**
     * The fee estimator.
     *
     * @protected
     * @type {IFeeEstimator | undefined}
     */
    this._feeEstimator = undefined

    /**
     * The chain id.
     *
     * @protected
     * @type {bigint | undefined}
     */
    this._chainId = undefined

    /** @private */
    this._ownerAccountAddress = address

    /**
     * An ethers provider to interact with a node of the blockchain. Note that Safe4337Pack only supports the Eip1193Provider.
     *
     * @protected
     * @type {Eip1193Provider | undefined}
     */
    this._provider = this._creatFailoverProvider(this._config)
  }

  /**
   * Predicts the address of a safe account.
   *
   * @param {string} owner - The safe owner's address.
   * @param {Pick<EvmErc4337WalletConfig, 'chainId' | 'safeModulesVersion'>} config - The safe configuration
   * @returns {string} The Safe address.
   */
  static predictSafeAddress (owner, { chainId, safeModulesVersion }) {
    const safeAddress = Safe4337Pack.predictSafeAddress({
      owners: [owner],
      threshold: 1,
      saltNonce: SALT_NONCE,
      chainId,
      safeVersion: '1.4.1',
      safeModulesVersion
    })

    return safeAddress
  }

  /**
   *    * Wraps a string RPC URL or provider into an EIP-1193 compatible provider.
   *
   * @private
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
   * @private
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The configuration object.
   * @returns {Eip1193Provider | undefined}
   */
  _creatFailoverProvider (config = this._config) {
    const { provider, retries = 3 } = config

    if (Array.isArray(provider)) {
      return provider
        .reduce(
          (failover, candidate) =>
            failover.addProvider(this._wrapEip1193Provider(candidate)),
          new FailoverProvider({ retries })
        )
        .initialize()
    }

    if (provider) {
      return this._wrapEip1193Provider(provider)
    }

    return undefined
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
   * @param {EvmTransaction | EvmTransaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    const { isSponsored, useNativeCoins } = mergedConfig

    if (isSponsored) {
      return { fee: 0n }
    }

    const fee = await this._getUserOperationGasCost([tx].flat(), {
      ...mergedConfig,
      amountToApprove: useNativeCoins ? 0n : BigInt(Number.MAX_SAFE_INTEGER)
    })

    return { fee: BigInt(fee) }
  }

  /**
   * Quotes the costs of a transfer operation.
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
    const safe4337Pack = await this._getSafe4337Pack()

    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    const userOp = await safe4337Pack.getUserOperationByHash(hash)

    if (!userOp || !userOp.transactionHash) {
      return null
    }

    return await evmReadOnlyAccount.getTransactionReceipt(userOp.transactionHash)
  }

  /**
   * Returns a user operation's receipt.
   *
   * @param {string} hash - The user operation hash.
   * @returns {Promise<UserOperationReceipt | null>} – The receipt, or null if the user operation has not been included in a block yet.
   */
  async getUserOperationReceipt (hash) {
    const safe4337Pack = await this._getSafe4337Pack()

    const userOp = await safe4337Pack.getUserOperationReceipt(hash)

    return userOp
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
   * Returns the safe's erc-4337 pack of the account.
   *
   * @protected
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config] - The configuration object. Defaults to this._config if not provided.
   * @returns {Promise<Safe4337Pack>} The safe's erc-4337 pack.
   */
  async _getSafe4337Pack (config = this._config) {
    const { isSponsored, useNativeCoins, paymasterUrl, paymasterAddress, paymasterToken } = config

    let cacheKey
    if (useNativeCoins) {
      cacheKey = 'native'
    } else if (isSponsored) {
      cacheKey = `sponsored:${paymasterUrl}`
    } else {
      cacheKey = `paymaster:${paymasterUrl}:${paymasterAddress}`
    }

    if (!this._safe4337Packs.has(cacheKey)) {
      const safe4337Pack = await Safe4337Pack.init({
        provider: this._creatFailoverProvider(config),
        bundlerUrl: config.bundlerUrl,
        safeModulesVersion: config.safeModulesVersion,
        options: {
          owners: [this._ownerAccountAddress],
          threshold: 1,
          saltNonce: SALT_NONCE
        },
        customContracts: {
          entryPointAddress: config.entryPointAddress
        },
        paymasterOptions: useNativeCoins
          ? undefined
          : {
              paymasterUrl,
              paymasterAddress,
              paymasterTokenAddress: paymasterToken?.address,
              skipApproveTransaction: true
            }
      })

      this._safe4337Packs.set(cacheKey, safe4337Pack)
    }

    return this._safe4337Packs.get(cacheKey)
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
    const address = await this.getAddress()

    const evmReadOnlyAccount = new WalletAccountReadOnlyEvm(address, this._config)

    return evmReadOnlyAccount
  }

  /** @private */
  async _getFeeEstimator () {
    if (!this._feeEstimator) {
      const { bundlerUrl } = this._config
      const isPimlico = bundlerUrl?.includes('pimlico')

      if (isPimlico) {
        this._feeEstimator = new PimlicoFeeEstimator()
      } else {
        const chainId = await this._getChainId()

        this._feeEstimator = new GenericFeeEstimator(
          this._config.provider,
          `0x${chainId.toString(16)}`
        )
      }
    }

    return this._feeEstimator
  }

  /** @private */
  async _getUserOperationGasCost (txs, { amountToApprove, ...config }) {
    const safe4337Pack = await this._getSafe4337Pack(config)

    const address = await this.getAddress()

    const paymasterTokenAddress = config.useNativeCoins ? undefined : config.paymasterToken?.address

    try {
      const safeOperation = await safe4337Pack.createTransaction({
        transactions: txs.map(tx => ({ from: address, ...tx })),
        options: {
          feeEstimator: await this._getFeeEstimator(),
          amountToApprove,
          paymasterTokenAddress
        }
      })

      const {
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        paymasterVerificationGasLimit,
        paymasterPostOpGasLimit,
        maxFeePerGas
      } = safeOperation.userOperation

      const gasCost = (callGasLimit + verificationGasLimit + preVerificationGas + paymasterVerificationGasLimit + paymasterPostOpGasLimit) * maxFeePerGas

      if (!paymasterTokenAddress) {
        return gasCost
      }

      const exchangeRate = await safe4337Pack.getTokenExchangeRate(paymasterTokenAddress)

      const gasCostInPaymasterToken = (gasCost * exchangeRate + (10n ** 18n - 1n)) / (10n ** 18n)

      return gasCostInPaymasterToken
    } catch (error) {
      if (error.message.includes('AA50')) {
        throw new Error('Simulation failed: not enough funds in the safe account to repay the paymaster.')
      }

      throw error
    }
  }
}
