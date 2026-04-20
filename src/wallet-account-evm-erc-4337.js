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

import { Contract, getBytes, hexlify, zeroPadValue, toBeHex } from 'ethers'

import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'

import { Bundler } from 'abstractionkit'
import { secp256k1 } from '@noble/curves/secp256k1'

import WalletAccountReadOnlyEvmErc4337 from './wallet-account-read-only-evm-erc-4337.js'

/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet-evm').KeyPair} KeyPair */

/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').ApproveOptions} ApproveOptions */

/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletConfig} EvmErc4337WalletConfig */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletPaymasterTokenConfig} EvmErc4337WalletPaymasterTokenConfig */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletSponsorshipPolicyConfig} EvmErc4337WalletSponsorshipPolicyConfig */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').TypedData} TypedData */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletNativeCoinsConfig} EvmErc4337WalletNativeCoinsConfig */

const QUOTE_MAX_AGE_MS = 2 * 60 * 1_000

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

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
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    return await this._ownerAccount.signTypedData({ domain, types, message })
  }

  /**
   * Approves a specific amount of tokens to a spender.
   *
   * @param {ApproveOptions} options - The approve options.
   * @returns {Promise<TransactionResult>} - The transaction's result.
   * @throws {Error} - If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
   */
  async approve (options) {
    if (!this._ownerAccount._provider) {
      throw new Error('The wallet must be connected to a provider to approve funds.')
    }

    const { token, spender, amount } = options
    const chainId = await this._getChainId()

    if (chainId === 1n && token.toLowerCase() === USDT_MAINNET_ADDRESS.toLowerCase()) {
      const currentAllowance = await this.getAllowance(token, spender)
      if (currentAllowance > 0n && BigInt(amount) > 0n) {
        throw new Error(
          'USDT requires the current allowance to be reset to 0 before setting a new non-zero value. Please send an "approve" transaction with an amount of 0 first.'
        )
      }
    }

    const abi = ['function approve(address spender, uint256 amount) returns (bool)']
    const contract = new Contract(token, abi, this._ownerAccount._provider)

    const tx = {
      to: token,
      value: 0,
      data: contract.interface.encodeFunctionData('approve', [spender, amount])
    }

    return await this.sendTransaction(tx)
  }

  /**
   * Sends a transaction.
   *
   * @param {EvmTransaction | EvmTransaction[]} tx -  The transaction, or an array of multiple transactions to send in batch.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    const fee = this._getValidCachedFee(tx) ?? (await this.quoteSendTransaction(tx, config)).fee
    this._lastQuote = undefined

    const hash = await this._sendUserOperation([tx].flat(), mergedConfig)

    return { hash, fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    const { isSponsored, transferMaxFee } = mergedConfig

    const tx = await WalletAccountEvm._getTransferTransaction(options)

    const fee = this._getValidCachedFee(tx) ?? (await this.quoteSendTransaction(tx, config)).fee
    this._lastQuote = undefined

    if (!isSponsored && transferMaxFee !== undefined && fee >= transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const hash = await this._sendUserOperation([tx], mergedConfig)

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
    this._disposed = true
  }

  /** @private */
  _getValidCachedFee (tx) {
    const quote = this._lastQuote

    if (!quote) {
      return undefined
    }

    if (Date.now() - quote.createdAt > QUOTE_MAX_AGE_MS) {
      this._lastQuote = undefined
      return undefined
    }

    if (WalletAccountReadOnlyEvmErc4337._getTxKey(tx) !== quote.txKey) {
      return undefined
    }

    this._lastQuote = undefined

    return quote.fee
  }

  /** @private */
  async _sendUserOperation (txs, config) {
    if (this._disposed) {
      throw new Error('Private key has been disposed.')
    }

    const calls = txs.map(tx => ({
      to: tx.to,
      value: tx.value !== undefined ? BigInt(tx.value) : 0n,
      data: tx.data || '0x'
    }))

    try {
      const { userOp, smartAccount, chainId } = await this._buildUserOperation(calls, config)

      // Sign using AK's capability-oriented signer API. The private key
      // stays as a Uint8Array throughout — never stringified — so dispose()
      // can zero the buffer.
      const keyPair = this._ownerAccount.keyPair
      const signer = {
        address: this._ownerAccountAddress,
        signHash: async (hash) => _signHashWithBytes(hash, keyPair.privateKey)
      }
      userOp.signature = await smartAccount.signUserOperationWithSigners(
        userOp,
        [signer],
        chainId
      )

      const bundler = new Bundler(config.bundlerUrl)
      return await bundler.sendUserOperation(userOp, smartAccount.entrypointAddress)
    } catch (err) {
      if (err.message?.includes('AA50')) {
        throw new Error('Not enough funds on the safe account to repay the paymaster.')
      }
      throw err
    }
  }
}

/** @private */
function _signHashWithBytes (hashHex, privateKeyBytes) {
  if (!privateKeyBytes) {
    throw new Error('Private key has been disposed.')
  }
  const hashBytes = getBytes(hashHex)
  const { r, s, recovery } = secp256k1.sign(hashBytes, privateKeyBytes, {
    lowS: true,
    extraEntropy: false
  })
  const rHex = zeroPadValue(toBeHex(r), 32)
  const sHex = zeroPadValue(toBeHex(s), 32)
  const v = recovery === 1 ? '1c' : '1b'
  return hexlify(rHex) + sHex.slice(2) + v
}
