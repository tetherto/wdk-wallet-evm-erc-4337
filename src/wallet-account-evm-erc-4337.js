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

import { Safe4337Pack } from '@wdk-safe-global/relay-kit'

import WalletAccountReadOnlyEvmErc4337, { SALT_NONCE } from './wallet-account-read-only-evm-erc-4337.js'

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@wdk/wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@wdk/wallet-evm').KeyPair} KeyPair */

/** @typedef {import('@wdk/wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@wdk/wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@wdk/wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet-evm').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

const FEE_TOLERANCE_COEFFICIENT = 1.2

/** @implements {IWalletAccount} */
export default class WalletAccountEvmErc4337 extends WalletAccountReadOnlyEvmErc4337 {
  /**
   * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {EvmErc4337WalletConfig} config - The configuration object.
   */
  constructor (seed, path, config) {
    const ownerAccount = new WalletAccountEvm(seed, path, config)

    super(ownerAccount._address, config)

    /**
     * The evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {EvmErc4337WalletConfig}
     */
    this._config = config

    /** @private */
    this._ownerAccount = ownerAccount
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return this._ownerAccount.index
  }

  /**
   * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @type {string}
   */
  get path () {
    return this._ownerAccount.path
  }

  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return this._ownerAccount.keyPair
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return await this._ownerAccount.sign(message)
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify (message, signature) {
    return await this._ownerAccount.verify(message, signature)
  }

  /**
   * Sends a transaction.
   *
   * @param {EvmTransaction | EvmTransaction[]} tx -  The transaction, or an array of multiple transactions to send in batch.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx, config) {
    const { paymasterToken } = config ?? this._config

    const { fee } = await this.quoteSendTransaction(tx, config)

    const hash = await this._sendUserOperation([tx].flat(), {
      paymasterTokenAddress: paymasterToken.address,
      amountToApprove: BigInt(Math.ceil(fee * FEE_TOLERANCE_COEFFICIENT))
    })

    return { hash, fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken' | 'transferMaxFee'>} [config] - If set, overrides the 'paymasterToken' and 'transferMaxFee' options defined in the wallet account configuration.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options, config) {
    const { paymasterToken, transferMaxFee } = config ?? this._config

    const tx = await WalletAccountEvm._getTransferTransaction(options)

    const { fee } = await this.quoteSendTransaction(tx, config)

    if (transferMaxFee !== undefined && fee >= transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const hash = await this._sendUserOperation([tx], {
      paymasterTokenAddress: paymasterToken.address,
      amountToApprove: BigInt(Math.ceil(fee * FEE_TOLERANCE_COEFFICIENT))
    })

    return { hash, fee }
  }

  /**
   * Returns a read-only copy of the account.
   *
   * @returns {Promise<WalletAccountReadOnlyEvmErc4337>} The read-only account.
   */
  async toReadOnlyAccount () {
    const address = await this._ownerAccount.getAddress()

    const readOnlyAccount = new WalletAccountReadOnlyEvmErc4337(address, this._config)

    return readOnlyAccount
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    this._ownerAccount.dispose()
  }

  async _getSafe4337Pack () {
    if (!this._safe4337Pack) {
      const owner = await this._ownerAccount.getAddress()

      this._safe4337Pack = await Safe4337Pack.init({
        provider: this._config.provider,
        signer: this._ownerAccount._account,
        bundlerUrl: this._config.bundlerUrl,
        safeModulesVersion: this._config.safeModulesVersion,
        options: {
          owners: [owner],
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

  /** @private */
  async _sendUserOperation (txs, options) {
    const safe4337Pack = await this._getSafe4337Pack()

    const address = await this.getAddress()

    const twoMinutesFromNow = Math.floor(Date.now() / 1_000) + 2 * 60

    try {
      const safeOperation = await safe4337Pack.createTransaction({
        transactions: txs.map(tx => ({ from: address, ...tx })),
        options: {
          validUntil: twoMinutesFromNow,
          feeEstimator: this._feeEstimator,
          ...options
        }
      })

      const signedSafeOperation = await safe4337Pack.signSafeOperation(safeOperation)

      return await safe4337Pack.executeTransaction({
        executable: signedSafeOperation
      })
    } catch (err) {
      if (err.message.includes('AA50')) {
        throw new Error('Not enough funds on the safe account to repay the paymaster.')
      }

      throw err
    }
  }
}
