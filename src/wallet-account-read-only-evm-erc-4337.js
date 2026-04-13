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
  createPublicClient,
  http,
  encodeFunctionData,
  keccak256,
  encodePacked,
  getContractAddress,
  hexToBigInt,
  getAddress,
  createClient,
  defineChain
} from 'viem'

import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction'

import { toSafeSmartAccount } from 'permissionless/accounts'

import { createSmartAccountClient } from 'permissionless'

import { createPimlicoClient } from 'permissionless/clients/pimlico'

import { ConfigurationError } from './errors.js'

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
 * @property {string} userOpHash
 * @property {string} sender
 * @property {string} nonce
 * @property {string} [paymaster]
 * @property {bigint} actualGasCost
 * @property {bigint} actualGasUsed
 * @property {boolean} success
 * @property {Object} receipt
 * @property {string[]} [logs]
 */

/**
 * @typedef {Object} CachedQuote
 * @property {bigint} fee - The estimated fee with tolerance buffer applied.
 * @property {number} createdAt - The timestamp when the quote was created.
 * @property {string} txKey - A serialized key of the transaction used for cache matching.
 */

/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
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

const SAFE_L2_SINGLETON = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762'
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'

const SAFE_MODULES_MAP = {
  '0.3.0': {
    safe4337ModuleAddress: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226',
    safeModuleSetupAddress: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
    entryPointVersion: '0.7'
  },
  '0.2.0': {
    safe4337ModuleAddress: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
    safeModuleSetupAddress: '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb',
    entryPointVersion: '0.6'
  }
}

const PROXY_CREATION_CODE = '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564'

const ENABLE_MODULES_ABI = [{
  inputs: [{ internalType: 'address[]', name: 'modules', type: 'address[]' }],
  name: 'enableModules',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}]

const SETUP_ABI = [{
  inputs: [
    { name: '_owners', type: 'address[]' },
    { name: '_threshold', type: 'uint256' },
    { name: 'to', type: 'address' },
    { name: 'data', type: 'bytes' },
    { name: 'fallbackHandler', type: 'address' },
    { name: 'paymentToken', type: 'address' },
    { name: 'payment', type: 'uint256' },
    { name: 'paymentReceiver', type: 'address' }
  ],
  name: 'setup',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}]

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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
     * Map of SmartAccountClient instances cached by configuration.
     *
     * @protected
     * @type {Map<string, Object>}
     */
    this._smartAccountClients = new Map()

    /**
     * Cached bundler client.
     *
     * @protected
     * @type {Object | undefined}
     */
    this._bundlerClient = undefined

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

    /** @private */
    this._ownerAccountAddress = address
  }

  /**
   * Predicts the address of a safe account.
   *
   * @param {string} owner - The safe owner's address.
   * @param {Pick<EvmErc4337WalletConfig, 'chainId' | 'safeModulesVersion'>} config - The safe configuration
   * @returns {string} The Safe address.
   */
  static predictSafeAddress (owner, { safeModulesVersion }) {
    const modules = SAFE_MODULES_MAP[safeModulesVersion]
    if (!modules) {
      throw new Error(`Unsupported safe modules version: ${safeModulesVersion}`)
    }

    const enableModulesData = encodeFunctionData({
      abi: ENABLE_MODULES_ABI,
      functionName: 'enableModules',
      args: [[modules.safe4337ModuleAddress]]
    })

    const initializer = encodeFunctionData({
      abi: SETUP_ABI,
      functionName: 'setup',
      args: [
        [owner],
        1n,
        modules.safeModuleSetupAddress,
        enableModulesData,
        modules.safe4337ModuleAddress,
        ZERO_ADDRESS,
        0n,
        ZERO_ADDRESS
      ]
    })

    const salt = keccak256(
      encodePacked(
        ['bytes32', 'uint256'],
        [keccak256(encodePacked(['bytes'], [initializer])), BigInt(SALT_NONCE)]
      )
    )

    const deploymentCode = encodePacked(
      ['bytes', 'uint256'],
      [PROXY_CREATION_CODE, hexToBigInt(SAFE_L2_SINGLETON)]
    )

    return getAddress(getContractAddress({
      from: SAFE_PROXY_FACTORY,
      salt,
      bytecode: deploymentCode,
      opcode: 'CREATE2'
    }))
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

    const { isSponsored, useNativeCoins } = mergedConfig

    if (isSponsored) {
      return { fee: 0n }
    }

    const estimatedFee = await this._getUserOperationGasCost([tx].flat(), {
      ...mergedConfig,
      amountToApprove: useNativeCoins ? 0n : BigInt(Number.MAX_SAFE_INTEGER)
    })

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
    const bundlerClient = this._getBundlerClient()

    const evmReadOnlyAccount = await this._getEvmReadOnlyAccount()

    try {
      const userOp = await bundlerClient.request({
        method: 'eth_getUserOperationByHash',
        params: [hash]
      })

      if (!userOp || !userOp.transactionHash) {
        return null
      }

      return await evmReadOnlyAccount.getTransactionReceipt(userOp.transactionHash)
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
    const bundlerClient = this._getBundlerClient()

    try {
      const receipt = await bundlerClient.request({
        method: 'eth_getUserOperationReceipt',
        params: [hash]
      })

      return receipt
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
   * Returns a viem account representing the owner (for use with permissionless.js).
   * Read-only accounts use a non-signing account.
   *
   * @protected
   * @returns {import('viem').Account} The viem account.
   */
  _getViemOwnerAccount () {
    return {
      address: this._ownerAccountAddress,
      type: 'local',
      source: 'custom',
      publicKey: this._ownerAccountAddress,
      async signMessage () { throw new Error('Read-only account cannot sign') },
      async signTransaction () { throw new Error('Read-only account cannot sign') },
      async signTypedData () { throw new Error('Read-only account cannot sign') }
    }
  }

  /**
   * Returns a viem public client.
   *
   * @protected
   * @returns {import('viem').PublicClient} The public client.
   */
  _getPublicClient () {
    if (!this._publicClient) {
      const providerUrl = typeof this._config.provider === 'string'
        ? this._config.provider
        : undefined

      this._publicClient = createPublicClient({
        chain: this._getChainDefinition(),
        transport: http(providerUrl)
      })
    }

    return this._publicClient
  }

  /**
   * Returns a viem chain definition from config.
   *
   * @protected
   * @returns {import('viem').Chain} The chain definition.
   */
  _getChainDefinition () {
    const rpcUrl = typeof this._config.provider === 'string'
      ? this._config.provider
      : 'http://localhost:8545'

    return defineChain({
      id: this._config.chainId,
      name: 'custom',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } }
    })
  }

  /**
   * Returns a bundler client for querying UserOperations.
   *
   * @protected
   * @returns {Object} The bundler client.
   */
  _getBundlerClient () {
    if (!this._bundlerClient) {
      this._bundlerClient = createClient({
        transport: http(this._config.bundlerUrl)
      })
    }

    return this._bundlerClient
  }

  /**
   * Returns a Smart Account Client configured for the given mode.
   *
   * @protected
   * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config] - The configuration object.
   * @returns {Promise<Object>} The smart account client.
   */
  async _getSmartAccountClient (config = this._config) {
    const { isSponsored, useNativeCoins, paymasterUrl, paymasterAddress, paymasterToken } = config

    let cacheKey
    if (useNativeCoins) {
      cacheKey = 'native'
    } else if (isSponsored) {
      cacheKey = `sponsored:${paymasterUrl}`
    } else {
      cacheKey = `paymaster:${paymasterUrl}:${paymasterAddress}`
    }

    if (!this._smartAccountClients.has(cacheKey)) {
      const publicClient = this._getPublicClient()
      const viemOwner = this._getViemOwnerAccount()

      const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [viemOwner],
        version: '1.4.1',
        entryPoint: {
          address: config.entryPointAddress,
          version: '0.7'
        },
        saltNonce: BigInt(SALT_NONCE),
        safeSingletonAddress: SAFE_L2_SINGLETON,
        useMultiSendForSetup: false
      })

      const publicClientForGas = this._getPublicClient()

      const clientConfig = {
        account: safeAccount,
        chain: this._getChainDefinition(),
        bundlerTransport: http(config.bundlerUrl),
        userOperation: {
          estimateFeesPerGas: async () => {
            const block = await publicClientForGas.getBlock()
            const baseFee = block.baseFeePerGas || 1000000000n
            const maxPriorityFeePerGas = 1500000000n
            const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas
            return { maxFeePerGas, maxPriorityFeePerGas }
          }
        }
      }

      if (!useNativeCoins && paymasterUrl) {
        const pimlicoPaymaster = createPimlicoClient({
          transport: http(paymasterUrl),
          entryPoint: {
            address: config.entryPointAddress,
            version: '0.7'
          }
        })

        clientConfig.paymaster = pimlicoPaymaster
      }

      const smartAccountClient = createSmartAccountClient(clientConfig)

      this._smartAccountClients.set(cacheKey, smartAccountClient)
    }

    return this._smartAccountClients.get(cacheKey)
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

  /**
   * Returns the token exchange rate from the paymaster.
   *
   * @private
   * @param {string} tokenAddress - The token address.
   * @param {string} paymasterUrl - The paymaster URL.
   * @param {string} entryPointAddress - The entry point address.
   * @returns {Promise<bigint>} The exchange rate.
   */
  async _getTokenExchangeRate (tokenAddress, paymasterUrl, entryPointAddress) {
    const isPimlico = paymasterUrl?.includes('pimlico')
    const paymasterClient = createClient({
      transport: http(paymasterUrl)
    })

    if (isPimlico) {
      const chainId = await this._getChainId()

      const response = await paymasterClient.request({
        method: 'pimlico_getTokenQuotes',
        params: [
          { tokens: [tokenAddress] },
          entryPointAddress,
          `0x${chainId.toString(16)}`
        ]
      })
      return BigInt(response.quotes[0].exchangeRate)
    } else {
      const response = await paymasterClient.request({
        method: 'pm_supportedERC20Tokens',
        params: [entryPointAddress]
      })
      const matchingToken = response.tokens.find(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase()
      )
      if (!matchingToken) {
        throw new Error(`No exchange rate found for token: ${tokenAddress}`)
      }
      return BigInt(matchingToken.exchangeRate)
    }
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

  /** @private */
  async _getUserOperationGasCost (txs, { amountToApprove, ...config }) {
    const smartAccountClient = await this._getSmartAccountClient(config)

    const address = await this.getAddress()

    const paymasterTokenAddress = config.useNativeCoins ? undefined : config.paymasterToken?.address

    try {
      const calls = txs.map(tx => ({
        to: tx.to,
        value: tx.value !== undefined ? BigInt(tx.value) : 0n,
        data: tx.data || '0x'
      }))

      if (paymasterTokenAddress && amountToApprove && amountToApprove > 0n) {
        const approveAbi = [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }]
        // Reset allowance to 0 first (required by USDT on mainnet), then set new amount
        calls.unshift(
          {
            to: paymasterTokenAddress,
            value: 0n,
            data: encodeFunctionData({ abi: approveAbi, functionName: 'approve', args: [config.paymasterAddress, 0n] })
          },
          {
            to: paymasterTokenAddress,
            value: 0n,
            data: encodeFunctionData({ abi: approveAbi, functionName: 'approve', args: [config.paymasterAddress, amountToApprove] })
          }
        )
      }

      const needsGasBuffer = _needsGasBuffer(config.bundlerUrl)

      const prepareParams = {
        calls,
        paymasterContext: paymasterTokenAddress
          ? { token: paymasterTokenAddress }
          : undefined
      }

      const userOp = needsGasBuffer
        ? await _prepareWithGasBuffer(smartAccountClient, prepareParams)
        : await smartAccountClient.prepareUserOperation(prepareParams)

      const {
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        paymasterVerificationGasLimit,
        paymasterPostOpGasLimit,
        maxFeePerGas
      } = userOp

      const gasCost = (
        (callGasLimit || 0n) +
        (verificationGasLimit || 0n) +
        (preVerificationGas || 0n) +
        (paymasterVerificationGasLimit || 0n) +
        (paymasterPostOpGasLimit || 0n)
      ) * (maxFeePerGas || 0n)

      if (!paymasterTokenAddress) {
        return gasCost
      }

      const exchangeRate = await this._getTokenExchangeRate(
        paymasterTokenAddress,
        config.paymasterUrl,
        config.entryPointAddress
      )

      const gasCostInPaymasterToken = (gasCost * exchangeRate + (10n ** 18n - 1n)) / (10n ** 18n)

      return gasCostInPaymasterToken
    } catch (error) {
      if (error.message?.includes('AA50')) {
        throw new Error('Simulation failed: not enough funds in the safe account to repay the paymaster.')
      }

      throw error
    }
  }
}

const GAS_ESTIMATION_BUFFER = 150n

/** Bundlers known to underestimate gas and require a buffer. */
const BUNDLERS_NEEDING_GAS_BUFFER = ['candide']

/**
 * @param {string} [bundlerUrl]
 * @returns {boolean}
 */
export function _needsGasBuffer (bundlerUrl) {
  if (!bundlerUrl) return false
  return BUNDLERS_NEEDING_GAS_BUFFER.some(name => bundlerUrl.includes(name))
}

/**
 * Prepares a UserOperation with a gas estimation buffer.
 * Uses a double-prepare pipeline: estimate → bump gas 150% → re-prepare with bumped values.
 * The second prepare skips gas estimation (values are pre-set) but still calls the paymaster
 * to get a fresh signature covering the bumped gas limits.
 *
 * @param {Object} smartAccountClient - The smart account client.
 * @param {Object} params - The prepareUserOperation params.
 * @returns {Promise<Object>} The prepared UserOperation with buffered gas limits.
 */
export async function _prepareWithGasBuffer (smartAccountClient, params) {
  const estimated = await smartAccountClient.prepareUserOperation(params)

  return smartAccountClient.prepareUserOperation({
    ...params,
    callGasLimit: estimated.callGasLimit * GAS_ESTIMATION_BUFFER / 100n,
    verificationGasLimit: estimated.verificationGasLimit * GAS_ESTIMATION_BUFFER / 100n
  })
}
