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

import { Safe4337Pack, GenericFeeEstimator, PimlicoFeeEstimator } from '@wdk-safe-global/relay-kit'

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@wdk-safe-global/relay-kit').UserOperationReceipt} UserOperationReceipt */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */

/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {string} paymasterAddress - The address of the paymaster smart contract.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
 */

/**
 * @typedef {Object} EvmErc4337WalletPaymasterTokenConfig
 * @property {false} [isSponsored] - Whether the transaction is sponsored.
 * @property {Object} paymasterToken - The paymaster token configuration.
 * @property {string} paymasterToken.address - The address of the paymaster token.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 */

/**
 * @typedef {Object} EvmErc4337WalletSponsorshipPolicyConfig
 * @property {true} isSponsored - Whether the transaction is sponsored.
 * @property {string} sponsorshipPolicyId - The sponsorship policy id.
 */

/**
 * @typedef {EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig)} EvmErc4337WalletConfig
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
    super(undefined)

    /**
     * The read-only evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>}
     */
    this._config = config

    /**
     * The safe's implementation of the erc-4337 standard.
     *
     * @protected
     * @type {Safe4337Pack | undefined}
     */
    this._safe4337Pack = undefined

    /**
     * The safe's fee estimator.
     *
     * @protected
     * @type {GenericFeeEstimator | undefined}
     */
    this._feeEstimator = undefined

    /**
     * The chain id.
     *
     * @protected
     * @type {bigint | undefined}
     */
    this._chainId = undefined

    /**
     * The predicted safe address (cached).
     *
     * @private
     * @type {string | undefined}
     */
    this._predictedAddress = undefined

    /** @private */
    this._ownerAccountAddress = address
  }

  /**
   * Returns the account's address.
   * Uses local CREATE2 address prediction without making network calls.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    if (!this._predictedAddress) {
      this._predictedAddress = Safe4337Pack.predictSafeAddress({
        threshold: 1,
        owners: [this._ownerAccountAddress],
        saltNonce: SALT_NONCE,
        chainId: this._config.chainId,
        safeModulesVersion: this._config.safeModulesVersion
      })
    }

    return this._predictedAddress
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
   * @param {Pick<EvmErc4337WalletPaymasterTokenConfig, 'isSponsored' | 'paymasterToken'> | Pick<EvmErc4337WalletSponsorshipPolicyConfig, 'isSponsored'>} [config] - If set, overrides the 'paymasterToken' and 'isSponsored' options defined in the wallet account configuration.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx, config) {
    const { paymasterToken, isSponsored } = config ?? this._config

    if (isSponsored) {
      return { fee: 0n }
    }

    const fee = await this._getUserOperationGasCost([tx].flat(), {
      paymasterTokenAddress: paymasterToken.address,
      amountToApprove: BigInt(Number.MAX_SAFE_INTEGER)
    })

    return { fee: BigInt(fee) }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Pick<EvmErc4337WalletPaymasterTokenConfig, 'isSponsored' | 'paymasterToken'> | Pick<EvmErc4337WalletSponsorshipPolicyConfig, 'isSponsored'>} [config] - If set, overrides the 'paymasterToken' and 'isSponsored' options defined in the wallet account configuration.
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
   * @returns {Promise<bigint>} - The allowance.
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
   * Returns the safe's erc-4337 pack of the account.
   *
   * @protected
   * @returns {Promise<Safe4337Pack>} The safe's erc-4337 pack.
   */
  async _getSafe4337Pack () {
    if (!this._safe4337Pack) {
      this._safe4337Pack = await Safe4337Pack.init({
        provider: this._config.provider,
        bundlerUrl: this._config.bundlerUrl,
        safeModulesVersion: this._config.safeModulesVersion,
        options: {
          owners: [this._ownerAccountAddress],
          threshold: 1,
          saltNonce: SALT_NONCE
        },
        paymasterOptions: {
          paymasterUrl: this._config.paymasterUrl,
          paymasterAddress: this._config.paymasterAddress,
          paymasterTokenAddress: this._config.paymasterToken?.address,
          skipApproveTransaction: true
        },
        customContracts: {
          entryPointAddress: this._config.entryPointAddress
        }
      })
    }

    return this._safe4337Pack
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
  async _getUserOperationGasCost (txs, options) {
    const safe4337Pack = await this._getSafe4337Pack()

    const address = await this.getAddress()

    try {
      const safeOperation = await safe4337Pack.createTransaction({
        transactions: txs.map(tx => ({ from: address, ...tx })),
        options: {
          feeEstimator: await this._getFeeEstimator(),
          ...options
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

      const exchangeRate = await safe4337Pack.getTokenExchangeRate(options.paymasterTokenAddress)

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
