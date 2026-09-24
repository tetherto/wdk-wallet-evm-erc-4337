export default class WalletManagerEvmErc4337 extends WalletManager {
    /**
     * Creates a new wallet manager for evm blockchains that implements the [erc-4337](https://www.erc4337.io/docs) standard and its account abstraction features.
     *
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {EvmErc4337WalletConfig} config - The configuration object.
     * @throws {ValueError} If the `provider` option is set to an empty list.
     */
    constructor(seed: string | Uint8Array, config: EvmErc4337WalletConfig);
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
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
     * Builds the account config, injecting the manager's shared provider so accounts reuse the
     * single ethers provider instance instead of opening their own.
     *
     * @private
     * @returns {EvmErc4337WalletConfig} The account configuration.
     */
    private _accountConfig;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in weis).
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getFeeRates(): Promise<FeeRates>;
}
export type Provider = import("ethers").Provider;
export type FeeRates = import("@tetherto/wdk-wallet-evm").FeeRates;
export type EvmErc4337WalletConfig = import("./wallet-account-evm-erc-4337.js").EvmErc4337WalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvmErc4337 from './wallet-account-evm-erc-4337.js';
