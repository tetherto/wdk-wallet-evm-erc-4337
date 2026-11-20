/** @implements {IWalletAccount} */
export default class WalletAccountEvmErc4337 extends WalletAccountReadOnlyEvmErc4337 implements IWalletAccount<UserOperationV7> {
    /**
     * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account whose safe owner is a raw private key.
     *
     * The account owns the key and wipes it on {@link dispose}.
     *
     * @param {string | Uint8Array} privateKey - The raw private key (hex string with or without 0x, or 32 bytes).
     * @param {EvmErc4337WalletConfig & EvmErc4337SafeOptions} config - The configuration object.
     * @throws {ValueError} If `config.safeAddress` is set and is not a well-formed evm address.
     * @returns {WalletAccountEvmErc4337} The wallet account.
     */
    static fromPrivateKey(privateKey: string | Uint8Array, config: EvmErc4337WalletConfig & EvmErc4337SafeOptions): WalletAccountEvmErc4337;
    /**
     * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account from a BIP-39 seed.
     *
     * @overload
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {string} path - The BIP-44 derivation path, relative to "m/44'/60'" (e.g. "0'/0/0").
     * @param {EvmErc4337WalletConfig & EvmErc4337SafeOptions} config - The configuration object.
     * @throws {ValueError} If the given seed phrase is invalid.
     * @throws {ValueError} If `config.safeAddress` is set and is not a well-formed evm address.
     */
    constructor(seed: string | Uint8Array, path: string, config: EvmErc4337WalletConfig & EvmErc4337SafeOptions);
    /**
     * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account from a BIP-39 seed at path m/44'/60'/0'/0/0.
     *
     * @overload
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {EvmErc4337WalletConfig & EvmErc4337SafeOptions} config - The configuration object.
     * @throws {ValueError} If the given seed phrase is invalid.
     * @throws {ValueError} If `config.safeAddress` is set and is not a well-formed evm address.
     */
    constructor(seed: string | Uint8Array, config: EvmErc4337WalletConfig & EvmErc4337SafeOptions);
    /**
     * Creates a new evm [erc-4337](https://www.erc4337.io/docs) wallet account using a signer as the safe's owner.
     *
     * The signer is wiped on {@link dispose} only if `shouldWipeSignerOnDisposal` is set. Unless `safeAddress` is set,
     * the safe's address is predicted from the signer's address on the first call to {@link getAddress}.
     *
     * @overload
     * @param {ISignerEvm} signer - A signer implementing the EVM signer interface.
     * @param {EvmErc4337WalletConfig & SignerOptions & EvmErc4337SafeOptions} config - The configuration object.
     * @throws {ValueError} If `config.safeAddress` is set and is not a well-formed evm address.
     */
    constructor(signer: ISignerEvm, config: EvmErc4337WalletConfig & SignerOptions & EvmErc4337SafeOptions);
    /**
     * Creates a read-only account for a safe whose address is already known. Not supported on the writable
     * account: a safe address cannot produce a signer. Use {@link WalletAccountReadOnlyEvmErc4337.fromSafeAddress}.
     *
     * @param {string} safeAddress - The safe's evm address.
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} config - The configuration object.
     * @throws {UnsupportedOperationError} Always; a writable account cannot be created from a safe address.
     * @returns {never}
     */
    static fromSafeAddress(safeAddress: string, config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">): never;
    /**
     * The evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {EvmErc4337WalletConfig}
     */
    protected _config: EvmErc4337WalletConfig;
    /**
     * If true, disposes the signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    protected _shouldWipeSignerOnDisposal: boolean;
    /** @private */
    private _signer;
    /**
     * The safe address given in the configuration, or `undefined` if the safe is predicted from the signer.
     *
     * @private
     * @type {string | undefined}
     */
    private _pinnedSafeAddress;
    /** @private */
    private _safeAddress;
    /**
     * True once the pinned safe has been checked against the signer.
     *
     * @private
     * @type {boolean}
     */
    private _pinnedSafeChecked;
    /** @private */
    private _quoteCache;
    /** @private */
    private _disposed;
    /**
     * True once this account's own {@link dispose} method has been called.
     *
     * This reflects the account's lifecycle only. A caller-supplied signer disposed externally
     * does not flip this flag -- the account is still considered alive until it is disposed itself,
     * even though its signer-dependent methods will throw a {@link DisposalError} (propagated from
     * the disposed signer) in the meantime.
     *
     * @type {boolean}
     */
    get disposed(): boolean;
    /**
     * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)),
     * or null if the account's signer is not bound to a BIP-44 position (e.g. private-key signers).
     *
     * @type {string | null}
     */
    get path(): string | null;
    /**
     * The account's key pair.
     *
     * The uint8 arrays are bound to the wallet account, so any external change will reflect to the internal representation. For this reason,
     * it's strongly recommended to treat the key pair as a read-only view of the keys. While it's still technically possible to alter their
     * content, client code should never do so.
     *
     * @type {KeyPair | null}
     */
    get keyPair(): KeyPair | null;
    /**
     * Returns the account's address: the `safeAddress` given in the configuration if set, otherwise the safe's
     * address predicted from the signer's address.
     *
     * @returns {Promise<string>} The account's address.
     * @throws {ValueError} If the signer's address is not a well-formed evm address.
     */
    getAddress(): Promise<string>;
    /**
     * Signs a message as the safe (ERC-1271 / SafeMessage), so the safe's `isValidSignature` accepts it.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     * @throws {ConfigurationError} If `safeAddress` is set and the signer cannot operate that safe.
     * @throws {DisposalError} If the account, or the externally supplied signer it uses, has been disposed.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs typed data according to EIP-712 as the safe (ERC-1271 / SafeMessage), so the safe's `isValidSignature` accepts it.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     * @throws {ConfigurationError} If `safeAddress` is set and the signer cannot operate that safe.
     * @throws {DisposalError} If the account, or the externally supplied signer it uses, has been disposed.
     */
    signTypedData({ domain, types, message }: TypedData): Promise<string>;
    /**
     * Signs a user operation built from the given transaction.
     *
     * If the transaction is not sponsored, it also estimates the transaction's costs and checks them against the transaction max. fee option.
     *
     * @param {EvmErc4337Transaction} tx - The transaction to include in the user operation.
     * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
     * @returns {Promise<UserOperationV7>} The signed user operation.
     * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
     * @throws {ConfigurationError} If `safeAddress` is set and the signer cannot operate that safe.
     * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
     * @throws {MaximumFeeExceededError} If the transaction is not sponsored, and the transaction's cost surpasses the transaction max. fee option.
     * @throws {TransactionError} If the paymaster reports AA50 (the account cannot repay the paymaster).
     * @throws {DisposalError} If the account, or the externally supplied signer it uses, has been disposed.
     */
    signTransaction(tx: EvmErc4337Transaction, config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<UserOperationV7>;
    /**
     * Approves a specific amount of tokens to a spender.
     *
     * @param {EvmErc4337ApproveOptions} options - The approve options, including any UserOperationV7 gas/fee overrides to apply to the underlying transaction.
     * @returns {Promise<TransactionResult>} - The transaction's result.
     * @throws {ProviderRequiredError} - If the wallet is not connected to a provider.
     * @throws {ValueError} - If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
     * @throws {DisposalError} If the account, or the externally supplied signer it uses, has been disposed.
     */
    approve(options: EvmErc4337ApproveOptions): Promise<TransactionResult>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * The result is cached internally for up to 2 minutes. A subsequent `sendTransaction` with the
     * same transaction and paymaster configuration reuses the cached operation — skipping the
     * gas-estimation and paymaster round-trips — after a lightweight on-chain nonce check, re-quoting
     * only if the nonce has moved.
     *
     * In a batched call (`tx` passed as `[tx1, tx2, ...]`), only the gas overrides on `tx1` are
     * honored — a UserOperation has a single set of gas fields regardless of how many calls it batches.
     *
     * @param {EvmErc4337Transaction | EvmErc4337Transaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
     * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
     * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
     * @throws {TransactionError} If the paymaster reports AA50 (the account cannot repay the paymaster).
     */
    quoteSendTransaction(tx: EvmErc4337Transaction | EvmErc4337Transaction[] | UserOperationV7, config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Sends a transaction.
     *
     * In a batched call (`tx` passed as `[tx1, tx2, ...]`), only the gas overrides on `tx1` are
     * honored — a UserOperation has a single set of gas fields regardless of how many calls it batches.
     *
     * If the transaction is not sponsored, it also estimates the transaction's costs and checks them against the transaction max. fee option.
     *
     * @param {EvmErc4337Transaction | EvmErc4337Transaction[]} tx -  The transaction, or an array of multiple transactions to send in batch.
     * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
     * @returns {Promise<TransactionResult>} The transaction's result.
     * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
     * @throws {ConfigurationError} If `safeAddress` is set and the signer cannot operate that safe.
     * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
     * @throws {MaximumFeeExceededError} If the transaction is not sponsored, and the transaction's cost surpasses the transaction max. fee option.
     * @throws {ValueError} If `nonceKey` is a bigint outside the uint192 range (0 to 2^192 - 1).
     * @throws {TransactionError} If the paymaster reports AA50 (the account cannot repay the paymaster).
     * @throws {DisposalError} If the account, or the externally supplied signer it uses, has been disposed.
     */
    sendTransaction(tx: EvmErc4337Transaction | EvmErc4337Transaction[] | UserOperationV7, config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<TransactionResult>;
    /**
     * Transfers a token to another address.
     *
     * If the transaction is not sponsored, it also estimates the transfer's costs and checks them against the transfer max. fee option.
     *
     * @param {EvmErc4337TransferOptions} options - The transfer's options, including any UserOperationV7 gas/fee overrides to apply to the underlying transaction.
     * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
     * @returns {Promise<TransferResult>} The transfer's result.
     * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
     * @throws {ConfigurationError} If `safeAddress` is set and the signer cannot operate that safe.
     * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
     * @throws {MaximumFeeExceededError} If the transaction is not sponsored, and the transfer's cost surpasses the transfer max. fee option.
     * @throws {ValueError} If `nonceKey` is a bigint outside the uint192 range (0 to 2^192 - 1).
     * @throws {TransactionError} If the paymaster reports AA50 (the account cannot repay the paymaster).
     * @throws {DisposalError} If the account, or the externally supplied signer it uses, has been disposed.
     */
    transfer(options: EvmErc4337TransferOptions, config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<TransferResult>;
    /**
     * Returns a read-only copy of the account.
     *
     * @returns {Promise<WalletAccountReadOnlyEvmErc4337>} The read-only account.
     */
    toReadOnlyAccount(): Promise<WalletAccountReadOnlyEvmErc4337>;
    /**
     * Returns the safe owner's address, as given by the signer.
     *
     * @protected
     * @returns {Promise<string>} The owner's address.
     */
    protected _getOwnerAddress(): Promise<string>;
    /**
     * Checks that the signer can operate the safe pinned through `safeAddress`. Nothing to check if no safe is pinned or
     * if it is the signer's own predicted safe; otherwise, it must be a deployed safe that counts the signer among its
     * owners. A successful check is cached.
     *
     * @private
     * @throws {ConfigurationError} If the signer cannot operate the pinned safe.
     * @returns {Promise<void>}
     */
    private _checkPinnedSafe;
    /**
     * Disposes the wallet account. The signer's private key is erased only if the account owns the signer (created from
     * a seed or private key, or with `shouldWipeSignerOnDisposal`); otherwise a signer you supplied is left untouched.
     */
    dispose(): void;
    /** @private */
    private _guardDisposed;
    /** @private */
    private _prepareForSend;
    /** @private */
    private _buildAtNonce;
    /** @private */
    private _resolveNonce;
    /** @private */
    private static _getTxKey;
    /** @private */
    private _consumeCachedQuote;
    /** @private */
    private _signUserOperation;
    /** @private */
    private _sendUserOperation;
    private _broadcastSignedUserOperation;
    private static _isSignedUserOperation;
    private static _getSignedUserOperationFee;
}
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type IWalletAccount<TSignedTransaction> = import("@tetherto/wdk-wallet").IWalletAccount<TSignedTransaction>;
export type KeyPair = import("@tetherto/wdk-wallet-evm").KeyPair;
export type ISignerEvm = import("@tetherto/wdk-wallet-evm/signers").ISignerEvm;
export type SignerOptions = import("@tetherto/wdk-wallet-evm").SignerOptions;
export type EvmErc4337Transaction = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337Transaction;
export type EvmErc4337GasOverrides = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337GasOverrides;
export type EvmErc4337TransferOptions = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337TransferOptions;
export type TransactionResult = import("@tetherto/wdk-wallet-evm").TransactionResult;
export type TransferResult = import("@tetherto/wdk-wallet-evm").TransferResult;
export type ApproveOptions = import("@tetherto/wdk-wallet-evm").ApproveOptions;
export type EvmErc4337WalletConfig = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337WalletConfig;
export type EvmErc4337WalletPaymasterTokenConfig = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337WalletPaymasterTokenConfig;
export type EvmErc4337WalletSponsorshipPolicyConfig = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337WalletSponsorshipPolicyConfig;
export type TypedData = import("./wallet-account-read-only-evm-erc-4337.js").TypedData;
export type EvmErc4337WalletNativeCoinsConfig = import("./wallet-account-read-only-evm-erc-4337.js").EvmErc4337WalletNativeCoinsConfig;
/**
 * The options of a token approval, extended with the optional UserOperationV7 gas overrides.
 */
export type EvmErc4337ApproveOptions = ApproveOptions & EvmErc4337GasOverrides;
export type EvmErc4337SafeOptions = {
    /**
     * - The address of an existing safe to operate, instead of the safe predicted from the signer's address (e.g. after the safe's owner was changed). Unless it is the signer's own predicted safe, it must be a deployed safe that counts the signer among its owners; this is checked on the first operation that signs or sends.
     */
    safeAddress?: string;
};
export type UserOperationV7 = import("abstractionkit").UserOperationV7;
export type SafeAccountV0_3_0 = import("abstractionkit").SafeAccountV0_3_0;
import WalletAccountReadOnlyEvmErc4337 from './wallet-account-read-only-evm-erc-4337.js';
