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

import { Safe4337Pack, GenericFeeEstimator } from '@wdk-safe-global/relay-kit'

import { ethers } from 'ethers'

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */

/**
 * @typedef {Object} EvmErc4337WalletConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {string} paymasterAddress - The address of the paymaster smart contract.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
 * @property {Object} paymasterToken - The paymaster token configuration.
 * @property {string} paymasterToken.address - The address of the paymaster token.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
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
     * @type {Record<string, Safe4337Pack>}
     */
    this._safe4337Packs = {}

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

    /** @private */
    this._ownerAccountAddress = address
  }

  /**
   * Returns the account's address.
   *
   * @param {string} [safe4337PackIdentifier] - The identifier of the safe's erc-4337 pack.
   * @returns {Promise<string>} The account's address.
   */
  async getAddress (safe4337PackIdentifier = null) {
    const safe4337pack = safe4337PackIdentifier ? await this._getSafe4337PackByIdentifier(safe4337PackIdentifier) : await this._getAccountSafe4337Pack()

    const address = await safe4337pack.protocolKit.getAddress()

    return address
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

    return await this.getTokenBalance(paymasterToken.address)
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @param {EvmTransaction | EvmTransaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
   * @param {string?} [safe4337PackIdentifier] - The identifier of the safe's erc-4337 pack. If not provided, the account's default safe's erc-4337 pack will be used.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx, config, safe4337PackIdentifier = null) {
    const { paymasterToken } = config ?? this._config

    const fee = await this._getUserOperationGasCost([tx].flat(), {
      paymasterTokenAddress: paymasterToken.address,
      amountToApprove: BigInt(Number.MAX_SAFE_INTEGER)
    }, safe4337PackIdentifier)

    return { fee: BigInt(fee) }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] -  If set, overrides the 'paymasterToken' option defined in the wallet account configuration
   * @param {string?} [safe4337PackIdentifier] - The identifier of the safe's erc-4337 pack. If not provided, the account's default safe's erc-4337 pack will be used.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   */
  async quoteTransfer (options, config) {
    const tx = await WalletAccountReadOnlyEvm._getTransferTransaction(options)

    const result = await this.quoteSendTransaction(tx, config, safe4337PackIdentifier)

    return result
  }

  /**
   * Returns a transaction's receipt.
   *
   * @param {string} hash - The user operation hash.
   * @param {string?} [safe4337PackIdentifier] - The identifier of the safe's erc-4337 pack. If not provided, the account's default safe's erc-4337 pack will be used.
   * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
   */
  async getTransactionReceipt (hash, safe4337PackIdentifier = null) {
    const safe4337Pack = safe4337PackIdentifier ? await this._getSafe4337PackByIdentifier(safe4337PackIdentifier) : await this._getAccountSafe4337Pack()

    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    const userOp = await safe4337Pack.getUserOperationByHash(hash)

    if (!userOp || !userOp.transactionHash) {
      return null
    }

    return await evmReadOnlyAccount.getTransactionReceipt(userOp.transactionHash)
  }

  /**
   * Returns the current allowance for the given token and spender.
   * @param {string} token - The token’s address.
   * @param {string} spender - The spender’s address.
   * @returns {Promise<bigint>} - The allowance.
   */
  async getAllowance (token, spender) {
    const readOnlyAccount = await this._getEvmReadOnlyAccount()

    return await readOnlyAccount.getAllowance(token, spender)
  }

  /**
   * Returns the safe4337PackIdentifier of the safe's erc-4337 pack of a specific set of owners.
   * @param {string[]} owners - The owners' addresses.
   * @param {number} threshold - The threshold of the owners.
   * 
   * @protected
   * 
   * @returns {string} The identifier of the safe's erc-4337 pack.
   */
  _getSafe4337PackIdentifier (owners, threshold) {
    const sortedOwners = owners.map(o => o.toLowerCase()).sort()
    return ethers.solidityPackedKeccak256(
      ['address[]', 'uint256'],
      [sortedOwners, threshold]
    )
  }

  /**
   * Returns the safe's erc-4337 pack of a specific set of owners.
   * @param {string[]} owners - The owners' addresses.
   * @param {number} threshold - The threshold of the owners.
   * @param {Signer?} signer - The signer of the owners. If not provided, the account's default safe's erc-4337 pack will be used.
   * 
   * @protected
   * 
   * @returns {Promise<Safe4337Pack>} The safe's erc-4337 pack.
   */
  async _getSafe4337Pack (owners, threshold, signer = null) {
    const safe4337PackIdentifier = this._getSafe4337PackIdentifier(owners, threshold)

    if (!this._safe4337Packs[safe4337PackIdentifier]) {
      this._safe4337Packs[safe4337PackIdentifier] = await Safe4337Pack.init({
        provider: this._config.provider, 
        signer: signer,
        bundlerUrl: this._config.bundlerUrl,
        safeModulesVersion: this._config.safeModulesVersion,
        options: {
          owners: owners,
          threshold: threshold,
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

    return this._safe4337Packs[safe4337PackIdentifier]
  }

  /**
   * Returns the safe's erc-4337 pack of the account.
   *
   * @protected
   * @returns {Promise<Safe4337Pack>} The safe's erc-4337 pack.
   */
  async _getAccountSafe4337Pack () {
    return await this._getSafe4337Pack([this._ownerAccountAddress], 1, null)
  }

  /**
   * Returns the safe's erc-4337 pack by identifier.
   * @param {string} safe4337PackIdentifier - The identifier of the safe's erc-4337 pack.
   * 
   * @protected
   * 
   * @returns {Safe4337Pack} The safe's erc-4337 pack.
   * @throws {Error} If the safe4337Pack with the given identifier doesn't exist.
   */
  _getSafe4337PackByIdentifier (safe4337PackIdentifier) {
    if (!this._safe4337Packs[safe4337PackIdentifier]) {
      throw new Error(`Safe4337Pack with identifier "${safe4337PackIdentifier}" not found. Please create it first using _createSafe4337Pack().`)
    }

    return this._safe4337Packs[safe4337PackIdentifier]
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
      const chainId = await this._getChainId()

      this._feeEstimator = new GenericFeeEstimator(
        this._config.provider,
        `0x${chainId.toString(16)}`
      )
    }

    return this._feeEstimator
  }

  /** @private */
  async _getUserOperationGasCost (txs, options, safe4337PackIdentifier = null) {
    const safe4337Pack = safe4337PackIdentifier ? await this._getSafe4337PackByIdentifier(safe4337PackIdentifier) : await this._getAccountSafe4337Pack()

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

      const gasCost = Number((callGasLimit + verificationGasLimit + preVerificationGas + paymasterVerificationGasLimit + paymasterPostOpGasLimit) * maxFeePerGas)

      const exchangeRate = await safe4337Pack.getTokenExchangeRate(options.paymasterTokenAddress)

      const gasCostInPaymasterToken = Math.ceil(gasCost * exchangeRate / 10 ** 18)

      return gasCostInPaymasterToken
    } catch (error) {
      if (error.message.includes('AA50')) {
        throw new Error('Simulation failed: not enough funds in the safe account to repay the paymaster.')
      }

      throw error
    }
  }
}
