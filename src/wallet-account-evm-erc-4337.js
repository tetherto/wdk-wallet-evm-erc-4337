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

import { Contract, hexlify, keccak256, randomBytes, toUtf8Bytes } from 'ethers'

import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'

import { AbstractionKitError, ENTRYPOINT_V7, calculateUserOperationMaxGasCost, fetchAccountNonce } from 'abstractionkit'

import WalletAccountReadOnlyEvmErc4337, { FEE_TOLERANCE_COEFFICIENT } from './wallet-account-read-only-evm-erc-4337.js'

/** @typedef {import('abstractionkit').UserOperationV7} UserOperationV7 */
/** @typedef {import('abstractionkit').SafeAccountV0_3_0} SafeAccountV0_3_0 */

/**
 * @internal
 * @typedef {Object} TransactionQuote
 * @property {bigint} fee - The estimated fee with tolerance buffer applied.
 * @property {number} createdAt - The timestamp when the quote was created.
 * @property {UserOperationV7} [userOp] - The built UserOperation, reusable by sendTransaction.
 * @property {SafeAccountV0_3_0} [smartAccount] - The smart account instance used to build the UserOperation.
 * @property {bigint} [chainId] - The chain id captured at quote time, used to sign the cached UserOperation for the right network.
 */

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet-evm').KeyPair} KeyPair */

/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').ApproveOptions} ApproveOptions */

/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337Transaction} EvmErc4337Transaction */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletConfig} EvmErc4337WalletConfig */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletPaymasterTokenConfig} EvmErc4337WalletPaymasterTokenConfig */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletSponsorshipPolicyConfig} EvmErc4337WalletSponsorshipPolicyConfig */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').TypedData} TypedData */
/** @typedef {import('./wallet-account-read-only-evm-erc-4337.js').EvmErc4337WalletNativeCoinsConfig} EvmErc4337WalletNativeCoinsConfig */

const QUOTE_MAX_AGE_MS = 2 * 60 * 1_000

const NONCE_KEY_SHIFT = 64n

const MAX_UINT192 = (1n << 192n) - 1n

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

/** @implements {IWalletAccount<UserOperationV7>} */
export default class WalletAccountEvmErc4337 extends WalletAccountReadOnlyEvmErc4337 {
  /**
   * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {EvmErc4337WalletConfig} config - The configuration object.
   */
  constructor (seed, path, config) {
    // Owner EOA only needs keys/address for 4337; strip `provider` so
    // wdk-wallet-evm does not open a second JsonRpcProvider.
    const { provider: _provider, ...ownerConfig } = config
    const ownerAccount = new WalletAccountEvm(seed, path, ownerConfig)

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

    /**
     * Cached quotes from fee estimations, keyed by serialized transaction.
     *
     * @private
     * @type {Map<string, TransactionQuote>}
     */
    this._quoteCache = new Map()
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
   * The uint8 arrays are bound to the wallet account, so any external change will reflect to the internal representation. For this reason,
   * it's strongly recommended to treat the key pair as a read-only view of the keys. While it's still technically possible to alter their
   * content, client code should never do so.
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
   * Signs a user operation built from the given transaction.
   *
   * If the transaction is not sponsored, it also estimates the transaction's costs and checks them against the transaction max. fee option.
   *
   * @param {EvmErc4337Transaction} tx - The transaction to include in the user operation.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<UserOperationV7>} The signed user operation.
   * @throws {Error} If the transaction is not sponsored, and the transaction's cost surpasses the transaction max. fee option.
   */
  async signTransaction (tx, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    const prepared = await this._prepareForSend(tx, [tx], mergedConfig)

    const fee = prepared.fee

    const { isSponsored, transactionMaxFee } = mergedConfig
    if (!isSponsored && transactionMaxFee !== undefined && fee > transactionMaxFee) {
      throw new Error('Exceeded maximum fee cost for transaction operation.')
    }

    const { userOp } = await this._signUserOperation([tx], { config: mergedConfig, cachedBuild: prepared })

    this._quoteCache.clear()

    return userOp
  }

  /**
   * Approves a specific amount of tokens to a spender.
   *
   * @param {ApproveOptions} options - The approve options.
   * @param {EvmErc4337GasOverrides} [txOverrides] - If set, applies these UserOperationV7 gas/fee overrides to the underlying transaction.
   * @returns {Promise<TransactionResult>} - The transaction's result.
   * @throws {Error} - If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
   */
  async approve (options, txOverrides) {
    if (!this._provider) {
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
    
    // No runner needed - only encoding calldata for the UserOperation.
    const contract = new Contract(token, abi)

    const tx = {
      to: token,
      value: 0,
      data: contract.interface.encodeFunctionData('approve', [spender, amount]),
      ...txOverrides
    }

    return await this.sendTransaction(tx)
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * The result is cached internally for up to 2 minutes. A subsequent `sendTransaction` with the
   * same transaction reuses the cached operation — skipping the gas-estimation and paymaster
   * round-trips — after a lightweight on-chain nonce check, re-quoting only if the nonce has moved.
   *
   * In a batched call (`tx` passed as `[tx1, tx2, ...]`), only the gas overrides on `tx1` are
   * honored — a UserOperation has a single set of gas fields regardless of how many calls it batches.
   *
   * An already-signed UserOperation (as returned by `signTransaction`) may also be passed; in that case
   * its fee is read from its own gas fields (in token-paymaster mode this reflects the native gas ceiling,
   * not the token amount).
   *
   * @param {EvmErc4337Transaction | EvmErc4337Transaction[] | UserOperationV7} tx - The transaction, an array of multiple transactions to send in batch, or an already-signed UserOperation.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    if (WalletAccountEvmErc4337._isSignedUserOperation(tx)) {
      return { fee: mergedConfig.isSponsored ? 0n : WalletAccountEvmErc4337._getSignedUserOperationFee(tx) }
    }

    const txKey = WalletAccountEvmErc4337._getTxKey(tx)

    if (mergedConfig.isSponsored) {
      this._quoteCache.set(txKey, { fee: 0n, createdAt: Date.now() })
      return { fee: 0n }
    }

    const gasCostResult = await this._getUserOperationGasCost([tx].flat(), mergedConfig)

    const fee = BigInt(gasCostResult.fee) * FEE_TOLERANCE_COEFFICIENT / 100n

    this._quoteCache.set(txKey, {
      fee,
      createdAt: Date.now(),
      userOp: gasCostResult.userOp,
      smartAccount: gasCostResult.smartAccount,
      chainId: gasCostResult.chainId
    })

    return { fee }
  }

  /**
   * Sends a transaction.
   *
   * In a batched call (`tx` passed as `[tx1, tx2, ...]`), only the gas overrides on `tx1` are
   * honored — a UserOperation has a single set of gas fields regardless of how many calls it batches.
   *
   * If the transaction is not sponsored, it also estimates the transaction's costs and checks them against the transaction max. fee option.
   *
   * An already-signed UserOperation (as returned by `signTransaction`) may also be passed; in that case it is
   * broadcast directly to the bundler, reusing the nonce baked in at sign time. The max-fee check is skipped
   * (it was already enforced during `signTransaction`).
   *
   * @param {EvmErc4337Transaction | EvmErc4337Transaction[] | UserOperationV7} tx -  The transaction, an array of multiple transactions to send in batch, or an already-signed UserOperation.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @returns {Promise<TransactionResult>} The transaction's result.
   * @throws {Error} If the transaction is not sponsored, and the transaction's cost surpasses the transaction max. fee option.
   * @throws {Error} If `nonceKey` is a bigint outside the uint192 range (0 to 2^192 - 1).
   */
  async sendTransaction (tx, config) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    if (WalletAccountEvmErc4337._isSignedUserOperation(tx)) {
      const fee = mergedConfig.isSponsored ? 0n : WalletAccountEvmErc4337._getSignedUserOperationFee(tx)

      const hash = await this._broadcastSignedUserOperation(tx)

      return { hash, fee }
    }

    const txs = [tx].flat()
    const prepared = await this._prepareForSend(tx, txs, mergedConfig)

    const { isSponsored, transactionMaxFee } = mergedConfig
    if (!isSponsored && transactionMaxFee !== undefined && prepared.fee > transactionMaxFee) {
      throw new Error('Exceeded maximum fee cost for transaction operation.')
    }

    const hash = await this._sendUserOperation(txs, { config: mergedConfig, cachedBuild: prepared })
    return { hash, fee: prepared.fee }
  }

  /**
   * Transfers a token to another address.
   *
   * If the transaction is not sponsored, it also estimates the transfer's costs and checks them against the transfer max. fee option.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
   * @param {EvmErc4337GasOverrides} [txOverrides] - If set, applies these UserOperationV7 gas/fee overrides to the underlying transaction.
   * @returns {Promise<TransferResult>} The transfer's result.
   * @throws {Error} If the transaction is not sponsored, and the transfer's cost surpasses the transfer max. fee option.
   * @throws {Error} If `nonceKey` is a bigint outside the uint192 range (0 to 2^192 - 1).
   */
  async transfer (options, config, txOverrides) {
    const mergedConfig = { ...this._config, ...config }

    if (config) {
      this._validateConfig(mergedConfig)
    }

    const { isSponsored, transferMaxFee } = mergedConfig

    const baseTx = await WalletAccountEvm._getTransferTransaction(options)
    const tx = { ...baseTx, ...txOverrides }

    const txs = [tx]
    const prepared = await this._prepareForSend(tx, txs, mergedConfig)

    if (!isSponsored && transferMaxFee !== undefined && prepared.fee >= transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const hash = await this._sendUserOperation(txs, { config: mergedConfig, cachedBuild: prepared })
    return { hash, fee: prepared.fee }
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

  /** @private */
  async _prepareForSend (tx, txs, config) {
    const nonce = await this._resolveNonce(config)

    if (nonce === undefined) {
      const cached = this._consumeCachedQuote(tx)
      if (cached?.userOp) {
        const onChainNonce = await fetchAccountNonce(this._provider, cached.smartAccount.entrypointAddress, cached.smartAccount.accountAddress)
        if (cached.userOp.nonce === onChainNonce) {
          return cached
        }
      }
    }

    return await this._buildAtNonce(txs, nonce, config)
  }

  /** @private */
  async _buildAtNonce (txs, nonce, config) {
    const calls = WalletAccountReadOnlyEvmErc4337._toMetaTransactions(txs)
    const txOverrides = {
      ...WalletAccountReadOnlyEvmErc4337._extractGasOverrides(txs[0]),
      ...(nonce !== undefined ? { nonce } : {})
    }

    const { userOp, smartAccount, chainId, tokenQuote } = await this._buildUserOperation(calls, config, txOverrides)

    const fee = config.isSponsored
      ? 0n
      : BigInt(tokenQuote ? tokenQuote.tokenCost : calculateUserOperationMaxGasCost(userOp)) * FEE_TOLERANCE_COEFFICIENT / 100n

    return { fee, userOp, smartAccount, chainId }
  }

  /** @private */
  async _resolveNonce (config) {
    if (config.nonceKey !== undefined && config.nonceKey !== null) {
      let key
      if (typeof config.nonceKey === 'string') {
        key = BigInt(keccak256(toUtf8Bytes(config.nonceKey))) & MAX_UINT192
      } else {
        key = BigInt(config.nonceKey)
        if (key < 0n || key > MAX_UINT192) {
          throw new Error('nonceKey must be within the uint192 range (0 to 2^192 - 1).')
        }
      }
      return await fetchAccountNonce(this._provider, ENTRYPOINT_V7, this._address, key)
    }

    if (config.parallel) {
      return BigInt(hexlify(randomBytes(24))) << NONCE_KEY_SHIFT
    }

    return undefined
  }

  /** @private */
  static _getTxKey (tx) {
    return JSON.stringify([tx].flat(), (_, v) => typeof v === 'bigint' ? v.toString() : v)
  }

  /** @private */
  _consumeCachedQuote (tx) {
    const txKey = WalletAccountEvmErc4337._getTxKey(tx)
    const quote = this._quoteCache.get(txKey)

    if (!quote) {
      return undefined
    }

    this._quoteCache.delete(txKey)

    if (Date.now() - quote.createdAt > QUOTE_MAX_AGE_MS) {
      return undefined
    }

    return quote
  }

  /** @private */
  async _signUserOperation (txs, { config, cachedBuild }) {
    const { userOp, smartAccount, chainId } = cachedBuild?.userOp
      ? cachedBuild
      : await this._buildUserOperation(
        WalletAccountReadOnlyEvmErc4337._toMetaTransactions(txs),
        config,
        WalletAccountReadOnlyEvmErc4337._extractGasOverrides(txs[0])
      )

    const signer = {
      address: this._ownerAccountAddress,
      signHash: async (hash) => this._ownerAccount._signer._account.signingKey.sign(hash).serialized
    }
    userOp.signature = await smartAccount.signUserOperationWithSigners(
      userOp,
      [signer],
      chainId
    )

    return { userOp, smartAccount, chainId }
  }

  /** @private */
  async _sendUserOperation (txs, { config, cachedBuild }) {
    try {
      const { userOp, smartAccount } = await this._signUserOperation(txs, { config, cachedBuild })

      return await this._getBundler().sendUserOperation(userOp, smartAccount.entrypointAddress)
    } catch (err) {
      if (err instanceof AbstractionKitError && err.message.includes('AA50')) {
        throw new Error('Not enough funds on the safe account to repay the paymaster.')
      }
      throw err
    }
  }

  /**
   * Broadcasts an already-signed UserOperation directly to the bundler.
   *
   * @private
   * @param {UserOperationV7} userOp - The signed UserOperation.
   * @returns {Promise<string>} The user operation hash.
   */
  async _broadcastSignedUserOperation (userOp) {
    try {
      return await this._getBundler().sendUserOperation(userOp, ENTRYPOINT_V7)
    } catch (err) {
      if (err instanceof AbstractionKitError && err.message.includes('AA50')) {
        throw new Error('Not enough funds on the safe account to repay the paymaster.')
      }
      throw err
    }
  }

  /**
   * Determines whether a value is an already-signed UserOperation (as returned by `signTransaction`)
   * rather than an unsigned {@link EvmErc4337Transaction} (or array of them).
   *
   * @private
   * @param {EvmErc4337Transaction | EvmErc4337Transaction[] | UserOperationV7} tx - The value to inspect.
   * @returns {boolean} True if the value is a signed UserOperation.
   */
  static _isSignedUserOperation (tx) {
    return !!tx.signature
  }

  /**
   * Computes the fee (with tolerance buffer) for an already-signed UserOperation, reusing the
   * same native gas-cost formula as the unsigned native path.
   *
   * In token-paymaster mode this reflects the native gas ceiling rather than the token amount:
   * the token cost is set by the paymaster at sign time and cannot be reproduced from the signed
   * UserOperation.
   *
   * @private
   * @param {UserOperationV7} userOp - The signed UserOperation.
   * @returns {bigint} The fee, in the smart account's native coin (wei).
   */
  static _getSignedUserOperationFee (userOp) {
    return BigInt(calculateUserOperationMaxGasCost(userOp)) * FEE_TOLERANCE_COEFFICIENT / 100n
  }
}
