/** @extends {WalletManager<ISignerEvm>} */
export default class WalletManagerEvmErc4337 extends WalletManager<ISignerEvm> {
    /**
     * Creates a new wallet manager for evm blockchains that implements the [erc-4337](https://www.erc4337.io/docs) standard and its account abstraction features.
     *
     * @overload
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {EvmErc4337WalletConfig} config - The configuration object.
     * @throws {ValueError} If the seed phrase is invalid.
     * @throws {ValueError} If the `provider` option is set to an empty list.
     */
    constructor(seed: string | Uint8Array, config: EvmErc4337WalletConfig);
    /**
     * Creates a new wallet manager for evm blockchains that implements the [erc-4337](https://www.erc4337.io/docs) standard from a default signer.
     *
     * The default signer must be derivable. Non-derivable signers (e.g. private-key signers) can only be registered by
     * name via {@link addSigner}. The manager never disposes a signer you supplied.
     *
     * @overload
     * @param {ISignerEvm} signer - The default signer.
     * @param {EvmErc4337WalletConfig} config - The configuration object.
     * @throws {InvalidSignerError} If the default signer does not support account derivation.
     * @throws {ValueError} If the `provider` option is set to an empty list.
     */
    constructor(signer: ISignerEvm, config: EvmErc4337WalletConfig);
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
    /**
     * If true, disposes the default signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    protected _shouldWipeDefaultSignerOnDisposal: boolean;
    /**
     * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)),
     * e.g. `getAccount(1)` returns the account with derivation path m/44'/60'/0'/0/1.
     *
     * @overload
     * @param {number} [index] - The index of the account to get (default: 0).
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
     * @returns {Promise<WalletAccountEvmErc4337>} The account.
     * @throws {NoSuchElementError} If a signer name is given but no signer exists with that name.
     * @throws {InvalidSignerError} If the signer doesn't support account derivation.
     * @throws {DisposalError} If the wallet manager or the given signer has been disposed.
     */
    getAccount(index?: number, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvmErc4337>;
    /**
     * Returns the wallet account associated with a registered signer. The signer is used as given, without deriving,
     * and is left untouched when the account is disposed.
     *
     * @overload
     * @param {string} signerName - The signer name registered via {@link addSigner}.
     * @returns {Promise<WalletAccountEvmErc4337>} The account.
     * @throws {NoSuchElementError} If no signer exists with the given name.
     * @throws {DisposalError} If the wallet manager or the given signer has been disposed.
     */
    getAccount(signerName: string): Promise<WalletAccountEvmErc4337>;
    /**
     * Returns the wallet account at a specific BIP-44 derivation path.
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccountByPath("0'/0/1");
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
     * @returns {Promise<WalletAccountEvmErc4337>} The account.
     * @throws {NoSuchElementError} If a signer name is given but no signer exists with that name.
     * @throws {InvalidSignerError} If the signer doesn't support account derivation.
     * @throws {DisposalError} If the wallet manager or the given signer has been disposed.
     */
    getAccountByPath(path: string, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvmErc4337>;
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
    /**
     * Disposes all the wallet accounts, erasing their private keys from the memory.
     */
    dispose(): void;
}
export type Provider = import("ethers").Provider;
export type FeeRates = import("@tetherto/wdk-wallet-evm").FeeRates;
export type ISignerEvm = import("@tetherto/wdk-wallet-evm/signers").ISignerEvm;
export type NoSuchElementError = import("@tetherto/wdk-wallet").NoSuchElementError;
export type EvmErc4337WalletConfig = import("./wallet-account-evm-erc-4337.js").EvmErc4337WalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvmErc4337 from './wallet-account-evm-erc-4337.js';
