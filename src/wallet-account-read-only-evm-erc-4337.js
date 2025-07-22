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

import WalletAccountEvmErc4337 from './wallet-account-evm-erc-4337.js'

import { Safe4337Pack } from '@wdk-safe-global/relay-kit'

/** @typedef {import('@wdk/wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@wdk/wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet-evm').TransferResult} TransferResult */
/** @typedef {import('@wdk/wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('./wallet-account-evm-erc-4337.js').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

/**
 * A buffer filled with zeros used as a placeholder for read-only accounts
 * that don't need actual seed data.
 *
 * @type {Buffer}
 */
const FAKE_SEED = Buffer.alloc(32).fill(0)

export default class WalletAccountReadOnlyEvmErc4337 extends WalletAccountEvmErc4337 {
  /**
   * Creates a new read-only EVM ERC-4337 wallet account.
   * 
   * @param {string} address - The wallet's address.
   * @param {EvmErc4337WalletConfig & { safeAddress?: string }} [config] - The configuration object.
   */
  constructor (address, config) {
    super(FAKE_SEED, "0'/0/0", config)

    /**
     * The wallet's address.
     * 
     * @protected
     * @type {string}
     */
    this._address = address

    /**
     * The deployed safe address.
     * 
     * @protected
     * @type {string|undefined}
     */
    this._safeAddress = config?.safeAddress
  }

  /**
   * Returns the account's address.
   * 
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    return this._address
  }

  /** @private */
  async _getSafe4337Pack () {
    if (!this._safe4337Pack) {
      const initConfig = {
        provider: this._config.provider,
        signer: this._account,
        bundlerUrl: this._config.bundlerUrl,
        safeModulesVersion: this._config.safeModulesVersion,
        options: {
          safeAddress: this._address,
          threshold: 1
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
      }

      this._safe4337Pack = await Safe4337Pack.init(initConfig)
    }

    return this._safe4337Pack
  }

  /**
   * Signs a message. This operation is not supported for read-only accounts.
   * 
   * @param {string} message - The message to sign.
   * @throws {Error} Always throws an error as signing is not supported.
   */
  async sign (message) {
    throw new Error('Cannot sign messages with a read-only account.')
  }

  /**
   * Verifies a message's signature.
   * 
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid and matches this account's address.
   */
  async verify (message, signature) {
    return await super.verify(message, signature)
  }

  /**
   * Sends a transaction. This operation is not supported for read-only accounts.
   * 
   * @param {EvmTransaction} tx - The transaction.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
   * @throws {Error} Always throws an error as sending transactions is not supported.
   */
  async sendTransaction (tx, config) {
    throw new Error('Cannot send transactions with a read-only account.')
  }

  /**
   * Transfers tokens. This operation is not supported for read-only accounts.
   * 
   * @param {TransferOptions} options - The transfer's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken' | 'transferMaxFee'>} [config] - If set, overrides the 'paymasterToken' and 'transferMaxFee' options defined in the wallet account configuration.
   * @throws {Error} Always throws an error as transferring tokens is not supported.
   */
  async transfer (options, config) {
    throw new Error('Cannot transfer tokens with a read-only account.')
  }
}
