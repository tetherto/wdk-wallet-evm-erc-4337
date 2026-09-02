export const SALT_NONCE: "0x69b348339eea4ed93f9d11931c3b894c8f9d8c7663a053024b11cb7eb4e5a1f6";
export const FEE_TOLERANCE_COEFFICIENT: 120n;
export default class WalletAccountReadOnlyEvmErc4337 extends WalletAccountReadOnly {
    /**
     * Predicts the address of a safe account.
     *
     * @param {string} owner - The safe owner's address.
     * @param {Pick<EvmErc4337WalletConfig, 'safeModulesVersion' | 'onChainIdentifier'>} config - The safe configuration.
     * @throws {ValueError} If `owner` is not a well-formed evm address.
     * @returns {string} The Safe address.
     */
    static predictSafeAddress(owner: string, config: Pick<EvmErc4337WalletConfig, "safeModulesVersion" | "onChainIdentifier">): string;
    /**
     * Creates a read-only account for a safe whose address is already known.
     *
     * The address is used as the account's own address, so balances, allowances and quotes resolve against that
     * safe. Its owner is unknown to the account: {@link verify} and {@link verifyTypedData} throw, and the safe must
     * already be deployed for {@link quoteSendTransaction} and {@link quoteTransfer}.
     *
     * @param {string} safeAddress - The safe's evm address. Normalized to its checksummed form.
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} config - The configuration object.
     * @throws {ValueError} If `safeAddress` is not a well-formed evm address.
     * @throws {ValueError} If the `provider` option is set to an empty array.
     * @throws {ConfigurationError} If `config.safeModulesVersion` is not in the supported set.
     * @returns {WalletAccountReadOnlyEvmErc4337} A read-only account whose address is `safeAddress`.
     */
    static fromSafeAddress(safeAddress: string, config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">): WalletAccountReadOnlyEvmErc4337;
    /**
     * Builds the init code overrides from the wallet configuration.
     *
     * @protected
     * @param {Pick<EvmErc4337WalletConfig, 'safeModulesVersion' | 'onChainIdentifier'>} config - The wallet configuration fields used for init code generation.
     * @returns {InitCodeOverrides} The init code overrides for SafeAccount creation.
     */
    protected static _getInitCodeOverrides(config: Pick<EvmErc4337WalletConfig, "safeModulesVersion" | "onChainIdentifier">): import('abstractionkit').InitCodeOverrides;
    /**
     * Creates a new read-only evm [erc-4337](https://www.erc4337.io/docs) wallet account.
     *
     * `address` is the safe owner's address; the account's own address is the counterfactual safe address derived
     * from it. To read a safe whose address is already known, use {@link fromSafeAddress}.
     *
     * @param {string} address - The safe owner's evm address.
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The configuration object.
     * @throws {ValueError} If `address` is not a well-formed evm address.
     * @throws {ValueError} If the `provider` option is set to an empty array.
     * @throws {ConfigurationError} If `config.safeModulesVersion` is not in the supported set.
     */
    constructor(address: string, config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">);
    /**
     * The read-only evm erc-4337 wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>}
     */
    protected _config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">;
    /**
     * An EIP-1193–compatible provider used to interact with the blockchain.
     *
     * Note: the provider type is restricted to EIP-1193 to ensure compatibility
     * with Safe4337Pack and to enable the failover mechanism. While RPC URLs
     * can still be provided in the configuration, they are internally wrapped
     * into an EIP-1193 provider.
     *
     * @protected
     * @type {Eip1193Provider}
     */
    protected _provider: Eip1193Provider;
    /**
     * Cached AbstractionKit bundler.
     *
     * @protected
     * @type {Bundler | undefined}
     */
    protected _bundler: Bundler | undefined;
    /**
     * The chain id.
     *
     * @protected
     * @type {bigint | undefined}
     */
    protected _chainId: bigint | undefined;
    /**
     * The safe owner's address, or `undefined` when the account was created from a safe address.
     *
     * @protected
     * @type {string | undefined}
     */
    protected _ownerAccountAddress: string | undefined;
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
     * @throws {ConfigurationError} If no paymaster token is configured (sponsored or native-coins mode).
     */
    getPaymasterTokenBalance(): Promise<bigint>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * The result is cached internally for up to 2 minutes. If `sendTransaction` is called with the
     * same transaction within that window, the cached fee is reused without an additional RPC round-trip.
     *
     * In a batched call (`tx` passed as `[tx1, tx2, ...]`), only the gas overrides on `tx1` are
     * honored — a UserOperation has a single set of gas fields regardless of how many calls it batches.
     *
     * @param {EvmErc4337Transaction | EvmErc4337Transaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
     * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
     * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
     * @throws {TransactionError} If the token paymaster reports AA50 (account does not hold the paymaster token).
     * @throws {ConfigurationError} If the account was created from a safe address that is not deployed.
     */
    quoteSendTransaction(tx: EvmErc4337Transaction | EvmErc4337Transaction[], config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Quotes the costs of a transfer operation.
     *
     * The result is cached internally for up to 2 minutes. If `transfer` is called with the
     * same transaction within that window, the cached fee is reused without an additional RPC round-trip.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @param {Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>} [config] - If set, overrides the given configuration options.
     * @param {EvmErc4337GasOverrides} [txOverrides] - If set, applies these UserOperationV7 gas/fee overrides to the underlying transaction.
     * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
     * @throws {ConfigurationError} If the override `config` is invalid or has missing required fields.
     * @throws {ConfigurationError} If, in token mode, the configured `paymasterAddress` does not match the paymaster address returned by the paymaster RPC. This guards against the auto-generated ERC-20 approval targeting an unexpected paymaster contract.
     * @throws {TransactionError} If the token paymaster reports AA50 (account does not hold the paymaster token).
     * @throws {ConfigurationError} If the account was created from a safe address that is not deployed.
     */
    quoteTransfer(options: TransferOptions, config?: Partial<EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig>, txOverrides?: EvmErc4337GasOverrides): Promise<Omit<TransferResult, "hash">>;
    /**
     * Returns a transaction's receipt.
     *
     * @deprecated Use {@link getTransaction} instead, which returns a normalized, finality-based receipt. The raw ethers receipt and the user operation receipt remain available on its `receipt` and `userOperationReceipt` properties.
     * @param {string} hash - The user operation hash.
     * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
     */
    getTransactionReceipt(hash: string): Promise<EvmTransactionReceipt | null>;
    /**
     * Returns a normalized, finality-based receipt for a user operation. Finality and confirmations come from the bundling transaction; `success` and `fee` come from the user operation.
     *
     * @param {string} hash - The user operation hash.
     * @returns {Promise<TransactionReceipt & EvmErc4337TransactionDetails>} The normalized receipt.
     * @throws {ValueError} If the hash is not a valid user operation hash.
     * @throws {NoSuchElementError} If no user operation has been found for the given hash.
     */
    getTransaction(hash: string): Promise<TransactionReceipt & EvmErc4337TransactionDetails>;
    /**
     * Blocks until a user operation reaches a terminal state (the requested finality target or `dropped`), or times out.
     *
     * @param {string} hash - The user operation hash.
     * @param {WaitForTransactionOptions} [options] - The wait options.
     * @returns {Promise<TransactionReceipt & EvmErc4337TransactionDetails>} The terminal receipt: the finality target reached (inspect `success` to tell success from revert), or `dropped`.
     * @throws {TimeoutError} If the target is not reached before the timeout.
     */
    waitForTransaction(hash: string, options?: WaitForTransactionOptions): Promise<TransactionReceipt & EvmErc4337TransactionDetails>;
    /**
     * Overrides the base default to allow for slower ERC-4337 bundling, inclusion, and confirmation.
     *
     * @type {number}
     */
    get defaultWaitTimeout(): number;
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
     * @throws {UnsupportedOperationError} If the account was created from a safe address, whose owner is unknown.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Verifies a typed data signature.
     *
     * @param {TypedData} typedData - The typed data to verify.
     * @param {string} signature - The signature to verify.
     * @throws {UnsupportedOperationError} If the account was created from a safe address, whose owner is unknown.
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
    protected _validateConfig(config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">): void;
    /**
     * Builds a safe account instance for the current owner.
     *
     * @protected
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config] - The wallet configuration. Defaults to the instance configuration.
     * @throws {ConfigurationError} If the account was created from a safe address that is not deployed.
     * @returns {Promise<SafeAccountV0_3_0>} The safe account instance.
     */
    protected _getSmartAccount(config?: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">): Promise<import('abstractionkit').SafeAccountV0_3_0>;
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
    /**
     * Wraps a string RPC URL or provider into an EIP-1193 compatible provider.
     *
     * @protected
     * @param {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
     * @returns { Eip1193Provider } A wrapped Eip1193Provider instance.
     */
    protected _wrapEip1193Provider (provider: string | Eip1193Provider): Eip1193Provider
    /**
     * Creates a FailoverProvider from the configured providers. If only one provider is supplied, it is wrapped and returned.
     *
     * @protected
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} [config] - The configuration object.
     * @returns {Eip1193Provider} A wrapped Eip1193Provider instance.
     * @throws {ValueError} If the `provider` option is set to an empty array.
     */
    protected _createFailoverProvider (config?: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">): Eip1193Provider
    /** @private */
    private _getEvmReadOnlyAccount;
    /**
     * Builds a UserOperation with paymaster fields applied.
     *
     * @protected
     * @param {MetaTransaction[]} calls - The meta-transactions to include in the UserOperation.
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The wallet configuration.
     * @param {EvmErc4337GasOverrides & Nonce} [txOverrides] - Optional UserOperationV7 gas overrides extracted from the input transaction(s), plus an optional explicit lane `nonce`.
     * @returns {Promise<BuiltUserOperation>} The built operation, signing context, and (in token mode) the paymaster quote.
     * @throws {ConfigurationError} If the account was created from a safe address that is not deployed.
     */
    protected _buildUserOperation(calls: import('abstractionkit').MetaTransaction[], config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">, txOverrides?: EvmErc4337GasOverrides & Nonce): Promise<BuiltUserOperation>;
    /**
     * Extracts the optional UserOperationV7 gas overrides from a single transaction.
     *
     * Only the fields actually consumed by AbstractionKit's `CreateUserOperationOverrides`
     * are picked. Numeric values are coerced to bigint.
     *
     * @protected
     * @param {EvmErc4337Transaction} [tx] - The transaction to read overrides from.
     * @returns {EvmErc4337GasOverrides} The overrides object (empty if `tx` is falsy or has no override fields).
     */
    protected static _extractGasOverrides(tx?: EvmErc4337Transaction): EvmErc4337GasOverrides;
    /**
     * Builds a UserOperation and returns its estimated gas cost.
     *
     * Returns the cost in the paymaster token when a token quote is available, otherwise in
     * native wei. Used by `quoteSendTransaction` and reused by `sendTransaction` via the cache.
     *
     * In a batched call, only `txs[0]`'s gas overrides are honored — a UserOperation
     * carries a single set of gas fields regardless of how many calls it batches.
     *
     * @protected
     * @param {EvmErc4337Transaction[]} txs - The EVM transactions to include in the UserOperation.
     * @param {Omit<EvmErc4337WalletConfig, 'transferMaxFee'>} config - The wallet configuration to use for the build.
     * @returns {Promise<BuiltUserOperation & Omit<TransactionResult, 'hash'>>} The built operation plus its raw fee (no tolerance buffer applied).
     * @throws {TransactionError} If the token paymaster reports AA50 (account does not hold the paymaster token).
     */
    protected _getUserOperationGasCost(txs: EvmErc4337Transaction[], config: Omit<EvmErc4337WalletConfig, "transferMaxFee" | "transactionMaxFee">): Promise<BuiltUserOperation & Omit<TransactionResult, "hash">>;
}
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type TransactionResult = import("@tetherto/wdk-wallet-evm").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet-evm").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet-evm").TransferResult;
export type EvmTransactionReceipt = import("@tetherto/wdk-wallet-evm").EvmTransactionReceipt;
export type TypedData = import("@tetherto/wdk-wallet-evm").TypedData;
export type UserOperationReceipt = import('abstractionkit').UserOperationReceiptResult;
export type TransactionReceipt = import("@tetherto/wdk-wallet").TransactionReceipt;
export type WaitForTransactionOptions = import("@tetherto/wdk-wallet").WaitForTransactionOptions;
/**
 * The ERC-4337-specific fields added to a normalized transaction receipt.
 */
export type EvmErc4337TransactionDetails = {
    /**
     * - The number of confirmations (0 while pending or dropped).
     */
    confirmations: number;
    /**
     * - The native ethers receipt, or null while the user operation is pending or dropped.
     */
    receipt: EvmTransactionReceipt | null;
    /**
     * - The user operation receipt, or null while pending or unavailable.
     */
    userOperationReceipt: UserOperationReceipt | null;
};
export type EvmErc4337Transaction = {
    /**
     * - The call's recipient.
     */
    to: string;
    /**
     * - The amount of native coin to send to the recipient (in wei).
     */
    value: number | bigint;
    /**
     * - The call's data in hex format.
     */
    data?: string;
    /**
     * - If set, overrides the user operations' call gas limit.
     */
    callGasLimit?: number | bigint;
    /**
     * - If set, overrides the user operations' verification gas limit.
     */
    verificationGasLimit?: number | bigint;
    /**
     * - If set, overrides the user operations' pre-verification gas.
     */
    preVerificationGas?: number | bigint;
    /**
     * - If set, overrides the user operations' max fee per gas (EIP-1559 cap). Treated as a pair with `maxPriorityFeePerGas`: setting either disables the bundler-fetched fee fallback for both.
     */
    maxFeePerGas?: number | bigint;
    /**
     * - If set, overrides the user operations' max priority fee per gas. Treated as a pair with `maxFeePerGas`: setting either disables the bundler-fetched fee fallback for both.
     */
    maxPriorityFeePerGas?: number | bigint;
};
/**
 * Gas-related UserOperationV7 overrides. Numeric fields accept `number` or `bigint`; numbers are
 * coerced to `bigint` by `_extractGasOverrides` before the operation is built. All fields are
 * optional; absent fields fall back to the bundler-fetched gas price (fee pair) or the bundler's
 * gas estimation (gas limits).
 */
export type EvmErc4337GasOverrides = {
    /**
     * - Override for the UserOperation's call gas limit.
     */
    callGasLimit?: number | bigint;
    /**
     * - Override for the UserOperation's verification gas limit.
     */
    verificationGasLimit?: number | bigint;
    /**
     * - Override for the UserOperation's pre-verification gas.
     */
    preVerificationGas?: number | bigint;
    /**
     * - Override for the UserOperation's max fee per gas (EIP-1559 cap).
     */
    maxFeePerGas?: number | bigint;
    /**
     * - Override for the UserOperation's max priority fee per gas.
     */
    maxPriorityFeePerGas?: number | bigint;
};
/**
 * A single explicit UserOperationV7 `nonce`, combined with `EvmErc4337GasOverrides` for the build
 * step to place the operation in a specific two-dimensional nonce lane. The `nonce` is derived
 * internally from the account's `parallel`/`nonceKey` configuration, never from user-supplied
 * transaction fields.
 */
export type Nonce = {
    /**
     * - Full 256-bit UserOperation nonce (`key << 64 | sequence`) placing the op in a specific lane. Omitted for default (key-0) sends, in which case the account fetches the current on-chain nonce.
     */
    nonce?: number | bigint;
};
export type BuiltUserOperation = {
    /**
     * - The fully-populated UserOperation ready to sign.
     */
    userOp: import('abstractionkit').UserOperationV7;
    /**
     * - The Safe account that will execute the operation.
     */
    smartAccount: import('abstractionkit').SafeAccountV0_3_0;
    /**
     * - The paymaster mode used to build the operation.
     */
    mode: 'native' | 'sponsored' | 'token';
    /**
     * - The chain id captured at build time.
     */
    chainId: bigint;
    /**
     * - The paymaster token quote, present only in token mode.
     */
    tokenQuote?: import('abstractionkit').TokenQuote;
};
export type OnChainIdentifier = {
    /**
     * - The project name included in the 50-byte on-chain marker.
     */
    project: string;
    /**
     * - The platform type (default: 'Web').
     */
    platform?: "Web" | "Mobile" | "Safe App" | "Widget";
    /**
     * - The tool name used to create the UserOperation.
     */
    tool?: string;
    /**
     * - Semver-style tool version string included in the on-chain marker (e.g. "1.0.0").
     */
    toolVersion?: string;
};
export type EvmErc4337WalletCommonConfig = {
    /**
     * - The blockchain's id (e.g., 1 for ethereum).
     */
    chainId: number;
    /**
     * - The url of the rpc provider, or an instance of a class that implements eip-1193. It's also possible to provide an array of urls or EIP 1193 providers instead. In such case, connection errors will cause the wallet to automatically fallback on the next provider in the list.
     */
    provider: string | Eip1193Provider | Array<string | Eip1193Provider>;
    /**
     * - If set and if 'provider' is a list of urls or EIP 1193 providers, the number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order. Default: 3.
     */
    retries?: number;
    /**
     * - The url of the bundler service.
     */
    bundlerUrl: string;
    /**
     * - Version of the Safe 4337 module set to deploy with the account (e.g. "0.3.0"). Determines the module addresses used in init code.
     */
    safeModulesVersion: string;
    /**
     * - Optional on-chain identifier. Appends a 50-byte project marker to every UserOperation callData. Pass a string to reuse it as the project name, or a full object for more control.
     */
    onChainIdentifier?: OnChainIdentifier | string;
    /**
     * - When true, each send is placed in a fresh, independent nonce lane (a random 192-bit key at sequence 0) so concurrent or back-to-back sends don't collide on the nonce. Ordering between such sends is not guaranteed and each consumes a new EntryPoint nonce slot. Ignored when `nonceKey` is set. Overridable per call.
     */
    parallel?: boolean;
    /**
     * - Send in an explicit nonce lane. A string is hashed to a deterministic key — a reusable named lane that resumes the same sequence across sessions; a number or bigint is used as the raw uint192 key and must be within the uint192 range (0 to 2^192 - 1), otherwise the send throws (pass a bigint or string for keys above 2^53). Sends sharing a key are ordered sequentially; different keys run in parallel. Overridable per call.
     */
    nonceKey?: number | bigint | string;
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
    /**
     * - The maximum fee amount for sendTransaction and signTransaction operations.
     */
    transactionMaxFee?: number | bigint;
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
     * - Identifier of the paymaster sponsorship policy to apply (provider-specific). Optional; some paymasters infer the policy from the project key.
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
    /**
     * - The maximum fee amount for sendTransaction and signTransaction operations.
     */
    transactionMaxFee?: number | bigint;
};
export type EvmErc4337WalletConfig = EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig | EvmErc4337WalletNativeCoinsConfig);
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
import { Bundler } from 'abstractionkit';
