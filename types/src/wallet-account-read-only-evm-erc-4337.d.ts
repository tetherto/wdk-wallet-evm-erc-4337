export const SALT_NONCE: "0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6";
export default class WalletAccountReadOnlyEvmErc4337 extends WalletAccountReadOnly {
    /**
     * Creates a new read-only evm [erc-4337](https://www.erc4337.io/docs) wallet account.
     *
     * @param {string} address - The evm account's address.
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The configuration object.
     */
    constructor(address: string, config: Omit<EvmErc4337WalletConfig, "transferMaxFee">);
    /**
     * The read-only evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>}
     */
    protected _config: Omit<EvmErc4337WalletConfig, "transferMaxFee">;
    /**
     * Map of Safe4337Pack instances cached by configuration.
     *
     * @protected
     * @type {Map<string, Safe4337Pack>}
     */
    protected _safe4337Packs;
    /**
     * The fee estimator.
     *
     * @protected
     * @type {IFeeEstimator | undefined}
     */
    protected _feeEstimator: IFeeEstimator | undefined;
    /**
     * Cached quote from the last fee estimation.
     *
     * @protected
     * @type {CachedQuote | undefined}
     */
    protected _lastQuote: CachedQuote | undefined;
    /**
     * The chain id.
     *
     * @protected
     * @type {bigint | undefined}
     */
    protected _chainId: bigint | undefined;
    /** @private */
    private _ownerAccountAddress;
    /**
     * Predicts the address of a safe account.
     *
     * @param {string} owner - The safe owner's address.
     * @param {Pick<EvmErc4337WalletConfig, 'chainId' | 'safeModulesVersion'>} config - The safe configuration
     * @returns {string} The Safe address.
     */
    static predictSafeAddress(owner: string, { chainId, safeModulesVersion }: Pick<EvmErc4337WalletConfig, "chainId" | "safeModulesVersion">): string;
    /**
     * Returns a serialized key for transaction cache matching.
     *
     * @protected
     * @param {EvmTransaction | EvmTransaction[]} tx - The transaction(s) to serialize.
     * @returns {string} The serialized transaction key.
     */
    protected static _getTxKey(tx: EvmTransaction | EvmTransaction[]): string;
    /**
     * Returns the account's eth balance.
     *
     * @returns {Promise<bigint>} The eth balance (in weis).
     */
    getBalance(): Promise<bigint>;
    /**
    * Returns the account balance for a specific token.
    *
    * @param {string} tokenAddress - The smart contract address of the token.
    * @returns {Promise<bigint>} The token balance (in base unit).
    */
    getTokenBalance(tokenAddress: string): Promise<bigint>;
    /**
     * Returns the account balances for multiple tokens.
     *
     * @param {string[]} tokenAddresses - The smart contract addresses of the tokens.
     * @returns {Promise<Record<string, bigint>>} A mapping of token addresses to their balances (in base units).
     */
    getTokenBalances(tokenAddresses: string[]): Promise<Record<string, bigint>>;
    /**
     * Returns the account's balance for the paymaster token provided in the wallet account configuration.
     *
     * @returns {Promise<bigint>} The paymaster token balance (in base unit).
     */
    getPaymasterTokenBalance(): Promise<bigint>;
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
    quoteSendTransaction(tx: EvmTransaction | EvmTransaction[], config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<Omit<TransactionResult, "hash">>;
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
    quoteTransfer(options: TransferOptions, config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<Omit<TransferResult, "hash">>;
    /**
     * Returns a transaction's receipt.
     *
     * @param {string} hash - The user operation hash.
     * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
     */
    getTransactionReceipt(hash: string): Promise<EvmTransactionReceipt | null>;
    /**
     * Returns a user operation's receipt.
     *
     * @param {string} hash - The user operation hash.
     * @returns {Promise<UserOperationReceipt | null>} – The receipt, or null if the user operation has not been included in a block yet.
     */
    getUserOperationReceipt(hash: string): Promise<UserOperationReceipt | null>;
    /**
     * Returns the current allowance for the given token and spender.
     *
     * @param {string} token - The token's address.
     * @param {string} spender - The spender's address.
     * @returns {Promise<bigint>} The allowance.
     */
    getAllowance(token: string, spender: string): Promise<bigint>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;

    /**
     * Validates the configuration to ensure all required fields are present.
     *
     * @protected
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The configuration to validate.
     * @throws {ConfigurationError} If the configuration is invalid or has missing required fields.
     * @returns {void}
     */
    protected _validateConfig(config: Omit<EvmErc4337WalletConfig, "transferMaxFee">): void;
    /**
     * Verifies a typed data signature.
     *
     * @param {TypedData} typedData - The typed data to verify.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verifyTypedData(typedData: TypedData, signature: string): Promise<boolean>;
    /**
     * Returns the safe's erc-4337 pack of the account.
     *
     * @protected
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config] - The configuration object. Defaults to this._config if not provided.
     * @returns {Promise<Safe4337Pack>} The safe's erc-4337 pack.
     */
    protected _getSafe4337Pack(config?: Omit<EvmErc4337WalletConfig, "transferMaxFee">): Promise<Safe4337Pack>;
    /**
     * Returns the chain id.
     *
     * @protected
     * @returns {Promise<bigint>} - The chain id.
     */
    protected _getChainId(): Promise<bigint>;
    /** @private */
    private _getEvmReadOnlyAccount;
    /** @private */
    private _getFeeEstimator;
    /** @private */
    private _getUserOperationGasCost;
}
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type UserOperationReceipt = import("@tetherto/wdk-safe-relay-kit").UserOperationReceipt;
export type ConfigurationError = import("./errors.js").ConfigurationError;
export type Safe4337Pack = import("@tetherto/wdk-safe-relay-kit").Safe4337Pack;
export type IFeeEstimator = import("@tetherto/wdk-safe-relay-kit").IFeeEstimator;
export type EvmTransaction = import("@tetherto/wdk-wallet-evm").EvmTransaction;
export type TransactionResult = import("@tetherto/wdk-wallet-evm").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet-evm").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet-evm").TransferResult;
export type EvmTransactionReceipt = import("@tetherto/wdk-wallet-evm").EvmTransactionReceipt;
export type TypedData = import("@tetherto/wdk-wallet-evm").TypedData;
export type EvmErc4337WalletCommonConfig = {
    /**
     * - The blockchain's id (e.g., 1 for ethereum).
     */
    chainId: number;
    /**
     * - The url of the rpc provider, or an instance of a class that implements eip-1193.
     */
    provider: string | Eip1193Provider;
    /**
     * - The url of the bundler service.
     */
    bundlerUrl: string;
    /**
     * - The address of the entry point smart contract.
     */
    entryPointAddress: string;
    /**
     * - The safe modules version.
     */
    safeModulesVersion: string;
};
export type EvmErc4337WalletPaymasterTokenConfig = {
    /**
     * - Whether the paymaster is sponsoring the account.
     */
    isSponsored?: false;
    /**
     * - Whether to use native coins instead of a paymaster to pay for gas fees.
     */
    useNativeCoins?: false;
    /**
     * - The url of the paymaster service.
     */
    paymasterUrl: string;
    /**
     * - The address of the paymaster smart contract.
     */
    paymasterAddress: string;
    /**
     * - The paymaster token configuration.
     */
    paymasterToken: {
        address: string;
    };
    /**
     * - The maximum fee amount for transfer operations.
     */
    transferMaxFee?: number | bigint;
};
export type EvmErc4337WalletSponsorshipPolicyConfig = {
    /**
     * - Whether the paymaster is sponsoring the account.
     */
    isSponsored: true;
    /**
     * - Whether to use native coins instead of a paymaster to pay for gas fees.
     */
    useNativeCoins?: false;
    /**
     * - The url of the paymaster service.
     */
    paymasterUrl: string;
    /**
     * - The sponsorship policy id.
     */
    sponsorshipPolicyId?: string;
};
export type EvmErc4337WalletNativeCoinsConfig = {
    /**
     * - Whether the paymaster is sponsoring the account.
     */
    isSponsored?: false;
    /**
     * - Whether to use native coins instead of a paymaster to pay for gas fees.
     */
    useNativeCoins: true;
    /**
     * - The maximum fee amount for transfer operations.
     */
    transferMaxFee?: number | bigint;
};
export type CachedQuote = {
    /**
     * - The estimated fee with tolerance buffer applied.
     */
    fee: bigint;
    /**
     * - The timestamp when the quote was created.
     */
    createdAt: number;
    /**
     * - A serialized key of the transaction used for cache matching.
     */
    txKey: string;
};
export type EvmErc4337WalletConfig = EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig);
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
