/** @implements {IWalletAccount} */
export default class WalletAccountEvmErc4337 extends WalletAccountReadOnlyEvmErc4337 implements IWalletAccount {
    /**
     * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
     * @param {EvmErc4337WalletConfig} config - The configuration object.
     */
    constructor(seed: string | Uint8Array, path: string, config: EvmErc4337WalletConfig);
    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmErc4337WalletConfig}
     */
    protected _config: EvmErc4337WalletConfig;
    /** @private */
    private _ownerAccount;
    /**
     * The derivation path's index of this account.
     *
     * @type {number}
     */
    get index(): number;
    /**
     * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * @type {string}
     */
    get path(): string;
    /**
     * The account's key pair.
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Approves a specific amount of tokens to a spender.
     *
     * @param {ApproveOptions} options - The approve options.
     * @returns {Promise<TransactionResult>} - The transaction’s result.
     * @throws {Error} - If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
     */
    approve(options: ApproveOptions): Promise<TransactionResult>;
    /**
     * Sends a transaction.
     *
     * @param {EvmTransaction | EvmTransaction[]} tx -  The transaction, or an array of multiple transactions to send in batch.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    sendTransaction(tx: EvmTransaction | EvmTransaction[], config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<TransactionResult>;
    /**
     * Transfers a token to another address.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken' | 'transferMaxFee'>} [config] - If set, overrides the 'paymasterToken' and 'transferMaxFee' options defined in the wallet account configuration.
     * @returns {Promise<TransferResult>} The transfer's result.
     */
    transfer(options: TransferOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken" | "transferMaxFee">): Promise<TransferResult>;
    /**
     * Returns a read-only copy of the account.
     *
     * @returns {Promise<WalletAccountReadOnlyEvmErc4337>} The read-only account.
     */
    toReadOnlyAccount(): Promise<WalletAccountReadOnlyEvmErc4337>;
    /**
     * Disposes the wallet account, erasing the private key from the memory.
     */
    dispose(): void;
    /** @private */
    private _sendUserOperation;
}
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type KeyPair = import("@tetherto/wdk-wallet-evm").KeyPair;
export type EvmTransaction = import("@tetherto/wdk-wallet-evm").EvmTransaction;
export type TransactionResult = import("@tetherto/wdk-wallet-evm").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet-evm").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet-evm").TransferResult;
export type ApproveOptions = import("@tetherto/wdk-wallet-evm").ApproveOptions;
export type EvmErc4337WalletConfig = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337WalletConfig;
import WalletAccountReadOnlyEvmErc4337 from './wallet-account-read-only-evm-erc-4337.js';
