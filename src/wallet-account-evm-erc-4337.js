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

import { WalletAccountEvm } from '@wdk/wallet-evm'

import { Safe4337Pack, GenericFeeEstimator } from '@wdk-safe-global/relay-kit'

/** @typedef {import('@wdk/wallet-evm').KeyPair} KeyPair */
/** @typedef {import('@wdk/wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@wdk/wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@wdk/wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet-evm').TransferResult} TransferResult */

/**
 * @typedef {Object} EvmErc4337WalletConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} [provider] - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {string} paymasterAddress - The address of the paymaster smart contract.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
 * @property {Object} paymasterToken - The paymaster token configuration.
 * @property {string} paymasterToken.address - The address of the paymaster token.
 * @property {number} [transferMaxFee] - The maximum fee amount for transfer operations.
 */

const SALT_NONCE = '0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6'
const FEE_TOLERANCE_COEFFICIENT = 1.2

export default class WalletAccountEvmErc4337 extends WalletAccountEvm {
  /**
   * Creates a new evm Erc4337 wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {EvmErc4337WalletConfig} [config] - The configuration object.
   */
  constructor (seed, path, config) {
    super(seed, path, config)

    /**
     * The configuration object.
     *
     * @protected
     * @type {EvmErc4337WalletConfig}
     */
    this._config = config

    /**
     * The Safe4337Pack instance used to interact with the Safe 4337 protocol.
     *
     * @private
     * @type {Safe4337Pack | null}
     */
    this._safe4337Pack = null

    /**
     * The fee estimator for the safe 4337 pack.
     *
     * @private
     * @type {GenericFeeEstimator}
     */
    this._feeEstimator = new GenericFeeEstimator(
      config.provider,
      `0x${config.chainId.toString(16)}`
    )
  }

  /**
   * Returns the balance of the account for the configured paymaster token.
   *
   * @returns {Promise<number>} The token balance (in base unit).
   */
  async getPaymasterTokenBalance () {
    const { paymasterToken } = this._config

    return await this.getTokenBalance(paymasterToken.address)
  }

  async getAddress () {
    const safe4337Pack = await this._getSafe4337Pack()
    const address = await safe4337Pack.protocolKit.getAddress()
    return address
  }

  /**
    * Sends a transaction.
    *
    * @param {EvmTransaction} tx -  The transaction.
    * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
    * @returns {Promise<TransactionResult>} The transaction's hash and fee.
    */
  async sendTransaction (tx, config) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to send transaction.')
    }

    const { fee } = await this.quoteSendTransaction(tx, config)

    const hash = await this._sendGaslessTransaction(tx, fee, config)

    return { hash, fee }
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @see {sendTransaction}
   * @param {EvmTransaction} tx - The transaction.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx, config) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to quote send transaction operations.')
    }

    const { paymasterToken } = config ?? this._config

    const fee = await this._getGasCostInPaymasterToken(tx, paymasterToken)

    return { fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken' | 'transferMaxFee'>} [config] - If set, overrides the 'paymasterToken' and 'transferMaxFee' options defined in the wallet account configuration.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options, config) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const { transferMaxFee } = config ?? this._config

    const tx = await this._getTransferTx(options)

    const { fee } = await this.quoteSendTransaction(tx, config)

    if (transferMaxFee !== undefined && fee >= transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const hash = await this._sendGaslessTransaction(tx, fee, config)

    return { hash, fee }
  }

  /**
   * Quotes the costs of a transfer operation in paymaster token.
   *
   * @see {transfer}
   * @param {TransferOptions} options - The transfer's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} config -  If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   */
  async quoteTransfer (options, config) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to quote transfer operations.')
    }

    const tx = await this._getTransferTx(options)

    const result = await this.quoteSendTransaction(tx, config)

    return result
  }

  /**
   * Initializes and returns the Safe4337Pack instance.
   *
   * @returns {Promise<Safe4337Pack>}
   * @private
   */
  async _getSafe4337Pack () {
    if (!this._safe4337Pack) {
      const address = await super.getAddress()

      this._safe4337Pack = await Safe4337Pack.init({
        provider: this._config.provider,
        signer: this._account,
        bundlerUrl: this._config.bundlerUrl,
        safeModulesVersion: this._config.safeModulesVersion,
        options: {
          owners: [address],
          threshold: 1,
          saltNonce: SALT_NONCE
        },
        paymasterOptions: {
          paymasterUrl: this._config.paymasterUrl,
          paymasterAddress: this._config.paymasterAddress,
          paymasterTokenAddress: this._config.paymasterToken.address,
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
   * Calculates the gas cost of a gasless transaction in the paymaster token.
   *
   * @param {EvmTransaction} tx - The transaction to be executed.
   * @param {Object} paymasterToken - The paymaster token configuration.
   * @returns {Promise<number>} The gas cost in the paymaster token.
   * @private
   */
  async _getGasCostInPaymasterToken (tx, paymasterToken) {
    const gasCost = await this._getGaslessTransactionGasCostInEth(tx, paymasterToken)

    const safe4337Pack = await this._getSafe4337Pack()

    const exchangeRate = await safe4337Pack.getTokenExchangeRate(paymasterToken.address)

    const gasCostInPaymasterToken = Math.ceil(gasCost * exchangeRate / (10 ** 18))

    return gasCostInPaymasterToken
  }

  /**
   * Calculates the gas cost of a gasless transaction in native token.
   *
   * @param {EvmTransaction} tx - The transaction to be executed.
   * @param {Object} paymasterToken - The paymaster token configuration.
   * @returns {Promise<number>} The gas cost in native token.
   * @private
   */
  async _getGaslessTransactionGasCostInEth (tx, paymasterToken) {
    const safe4337Pack = await this._getSafe4337Pack()

    try {
      const safeOperation = await safe4337Pack.createTransaction(
        {
          transactions: [tx],
          options: {
            feeEstimator: this._feeEstimator,
            paymasterTokenAddress: paymasterToken.address,
            amountToApprove: BigInt(Number.MAX_SAFE_INTEGER)
          }
        }
      )

      const {
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        paymasterVerificationGasLimit,
        paymasterPostOpGasLimit,
        maxFeePerGas
      } = safeOperation.userOperation

      return Number((callGasLimit + verificationGasLimit + preVerificationGas + paymasterVerificationGasLimit + paymasterPostOpGasLimit) * maxFeePerGas)
    } catch (error) {
      if (error.message.includes('AA50')) {
        throw new Error(
          'Simulation failed: not enough funds in the safe account to repay the paymaster.'
        )
      }
      throw error
    }
  }

  /**
   * Sends a gasless transaction using Safe4337Pack.
   *
   * @private
   * @param {EvmTransaction} tx - The transaction to be executed.
   * @param {number} fee - The transaction fee.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
   * @returns {Promise<string>} The transaction's hash.
   */
  async _sendGaslessTransaction (tx, fee, config) {
    const paymasterToken = config?.paymasterToken ?? this._config.paymasterToken

    const safe4337Pack = await this._getSafe4337Pack()

    const twoMinutesFromNow = Math.floor(Date.now() / 1_000) + 2 * 60

    try {
      const safeOperation = await safe4337Pack.createTransaction({
        transactions: [tx],
        options: {
          validUntil: twoMinutesFromNow,
          feeEstimator: this._feeEstimator,
          paymasterTokenAddress: paymasterToken.address,
          amountToApprove: BigInt(Math.ceil(fee * FEE_TOLERANCE_COEFFICIENT))
        }
      })

      const signedSafeOperation = await safe4337Pack.signSafeOperation(
        safeOperation
      )

      return await safe4337Pack.executeTransaction({
        executable: signedSafeOperation
      })
    } catch (err) {
      if (err.message.includes('AA50')) {
        throw new Error(
          'Not enough funds on the safe account to repay the paymaster.'
        )
      }
      throw err
    }
  }
}
