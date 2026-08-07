export default class WalletManagerEvmErc4337 extends WalletManager {
    /**
     * Creates a new wallet manager for evm blockchains that implements the [erc-4337](https://www.erc4337.io/docs) standard and its account abstraction features.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {EvmErc4337WalletConfig} config - The configuration object.
     */
    constructor(seed: string | Uint8Array, config: EvmErc4337WalletConfig);
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider}
     */
    protected _provider: Provider;
    /**
     * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccount(1);
     * @param {number} [index] - The index of the account to get (default: 0).
     * @returns {Promise<WalletAccountEvmErc4337>} The account.
     */
    getAccount(index?: number): Promise<WalletAccountEvmErc4337>;
    /**
     * Returns the wallet account at a specific BIP-44 derivation path.
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccountByPath("0'/0/1");
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @returns {Promise<WalletAccountEvmErc4337>} The account.
     */
    getAccountByPath(path: string): Promise<WalletAccountEvmErc4337>;
    /**
     * Adapts an ethers Provider (or failover aggregate) to EIP-1193 without constructing
     * a new JsonRpcProvider. Already-EIP-1193 objects are returned as-is.
     *
     * @protected
     * @param {Provider | Eip1193Provider} provider - An ethers Provider, failover aggregate, or EIP-1193 provider to adapt.
     * @returns {Eip1193Provider} An EIP-1193-compatible provider that reuses the given client.
     */
    protected static _asEip1193(provider: Provider | Eip1193Provider): Eip1193Provider;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in weis).
     */
    getFeeRates(): Promise<FeeRates>;
}
export type Provider = import("ethers").Provider;
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type FeeRates = import("@tetherto/wdk-wallet-evm").FeeRates;
export type EvmErc4337WalletConfig = import("./wallet-account-evm-erc-4337.js").EvmErc4337WalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvmErc4337 from './wallet-account-evm-erc-4337.js';
