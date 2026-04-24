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
 * @typedef {Object} OnchainIdentifier
 * @property {string} project - The project name included in the 50-byte on-chain marker.
 * @property {'Web' | 'Mobile' | 'Safe App' | 'Widget'} [platform]
 * @property {string} [tool]
 * @property {string} [toolVersion]
 */
/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
 * @property {OnchainIdentifier | string} [onchainIdentifier] - Optional AbstractionKit on-chain identifier. Appends a 50-byte project marker to every UserOperation callData. Pass a string to reuse it as the project name, or a full object for more control.
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
export const SALT_NONCE: "0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6";
export default class WalletAccountReadOnlyEvmErc4337 extends WalletAccountReadOnly {
    /**
     * Predicts the address of a safe account. Delegates to AbstractionKit's
     * offline CREATE2 derivation (no RPC calls).
     *
     * @param {string} owner - The safe owner's address.
     * @param {Pick<EvmErc4337WalletConfig, 'safeModulesVersion' | 'onchainIdentifier' | 'entryPointAddress'>} config - The safe configuration.
     * @returns {string} The Safe address.
     */
    static predictSafeAddress(owner: string, config: Pick<EvmErc4337WalletConfig, "safeModulesVersion" | "onchainIdentifier" | "entryPointAddress">): string;
    /**
     * Returns a serialized key for transaction cache matching.
     *
     * @protected
     * @param {EvmTransaction | EvmTransaction[]} tx - The transaction(s) to serialize.
     * @returns {string} The serialized transaction key.
     */
    protected static _getTxKey(tx: EvmTransaction | EvmTransaction[]): string;
    /**
     * Builds AbstractionKit InitCodeOverrides from the wallet configuration.
     *
     * @protected
     * @param {Partial<EvmErc4337WalletConfig>} config
     * @returns {object}
     */
    protected static _getInitCodeOverrides(config: Partial<EvmErc4337WalletConfig>): object;
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
     * Cached AbstractionKit bundler.
     *
     * @protected
     * @type {Bundler | undefined}
     */
    protected _bundler: Bundler | undefined;
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
     * Verifies a typed data signature.
     *
     * @param {TypedData} typedData - The typed data to verify.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verifyTypedData(typedData: TypedData, signature: string): Promise<boolean>;
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
     * Builds an AbstractionKit SafeAccountV0_3_0 instance for the current owner.
     * Omits factoryAddress/factoryData when the account is already deployed, so
     * subsequent UserOperations don't try to redeploy it (which would revert at
     * the EntryPoint).
     *
     * @protected
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config]
     * @returns {Promise<object>} The AbstractionKit SafeAccountV0_3_0 instance.
     */
    protected _getSmartAccount(config?: Omit<EvmErc4337WalletConfig, "transferMaxFee">): Promise<object>;
    /**
     * Checks whether the Safe account has already been deployed.
     *
     * @protected
     * @param {string} address
     * @returns {Promise<boolean>}
     */
    protected _isAccountDeployed(address: string): Promise<boolean>;
    /**
     * Returns an AbstractionKit Bundler for querying UserOperations.
     *
     * @protected
     * @returns {Bundler} The bundler.
     */
    protected _getBundler(): Bundler;
    /**
     * Returns the chain id.
     *
     * @protected
     * @returns {Promise<bigint>} - The chain id.
     */
    protected _getChainId(): Promise<bigint>;
    /** @private */
    private _getEvmReadOnlyAccount;
    /**
     * Builds a UserOperation via AbstractionKit with paymaster fields applied.
     * Shared by gas quoting (read-only) and sending (full-access).
     *
     * - Native (no paymaster): delegates to AK's built-in estimation.
     * - Candide paymaster: runs AK's full estimation via the Candide bundler,
     * All paymaster flows use the same pipeline:
     *   1. Fetch bundler-specific gas prices if needed (e.g. Pimlico).
     *   2. Full AK estimation via createUserOperation with the bundler.
     *   3. Erc7677Paymaster applies paymaster fields with re-estimation.
     *
     * @protected
     * @param {object[]} calls
     * @param {object} config
     * @returns {Promise<object>} The fully-populated UserOperation ready to sign.
     */
    protected _buildUserOperation(calls: object[], config: object): Promise<object>;
    /** @private */
    private _getUserOperationGasCost;
}
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type EvmTransaction = import("@tetherto/wdk-wallet-evm").EvmTransaction;
export type TransactionResult = import("@tetherto/wdk-wallet-evm").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet-evm").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet-evm").TransferResult;
export type EvmTransactionReceipt = import("@tetherto/wdk-wallet-evm").EvmTransactionReceipt;
export type TypedData = import("@tetherto/wdk-wallet-evm").TypedData;
export type UserOperationReceipt = {
    userOpHash: string;
    sender: string;
    nonce: string;
    paymaster?: string;
    actualGasCost: bigint;
    actualGasUsed: bigint;
    success: boolean;
    receipt: any;
    logs?: string[];
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
export type OnchainIdentifier = {
    /**
     * - The project name included in the 50-byte on-chain marker.
     */
    project: string;
    platform?: "Web" | "Mobile" | "Safe App" | "Widget";
    tool?: string;
    toolVersion?: string;
};
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
    /**
     * - Optional AbstractionKit on-chain identifier. Appends a 50-byte project marker to every UserOperation callData. Pass a string to reuse it as the project name, or a full object for more control.
     */
    onchainIdentifier?: OnchainIdentifier | string;
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
export type EvmErc4337WalletConfig = EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig);
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
import { Bundler } from 'abstractionkit';
