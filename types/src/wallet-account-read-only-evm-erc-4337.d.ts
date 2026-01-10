/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */
/** @typedef {import('@wdk-safe-global/relay-kit').UserOperationReceipt} UserOperationReceipt */
/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet-evm').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet-evm').EvmTransactionReceipt} EvmTransactionReceipt */
/**
 * @typedef {Object} EvmErc4337WalletCommonConfig
 * @property {number} chainId - The blockchain's id (e.g., 1 for ethereum).
 * @property {string | Eip1193Provider} provider - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {string} bundlerUrl - The url of the bundler service.
 * @property {string} paymasterUrl - The url of the paymaster service.
 * @property {string} paymasterAddress - The address of the paymaster smart contract.
 * @property {string} entryPointAddress - The address of the entry point smart contract.
 * @property {string} safeModulesVersion - The safe modules version.
 */
/**
 * @typedef {Object} EvmErc4337WalletPaymasterTokenConfig
 * @property {false} [isSponsored] - Whether the transaction is sponsored.
 * @property {Object} paymasterToken - The paymaster token configuration.
 * @property {string} paymasterToken.address - The address of the paymaster token.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 */
/**
 * @typedef {Object} EvmErc4337WalletSponsorshipPolicyConfig
 * @property {true} isSponsored - Whether the transaction is sponsored.
 * @property {string} sponsorshipPolicyId - The sponsorship policy id.
 */
/**
 * @typedef {EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig)} EvmErc4337WalletConfig
 */
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
     * The safe's implementation of the erc-4337 standard.
     *
     * @protected
     * @type {Safe4337Pack | undefined}
     */
    protected _safe4337Pack: Safe4337Pack | undefined;
    /**
     * The safe's fee estimator.
     *
     * @protected
     * @type {GenericFeeEstimator | undefined}
     */
    protected _feeEstimator: GenericFeeEstimator | undefined;
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
     * Returns the account's balance for the paymaster token provided in the wallet account configuration.
     *
     * @returns {Promise<bigint>} The paymaster token balance (in base unit).
     */
    getPaymasterTokenBalance(): Promise<bigint>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {EvmTransaction | EvmTransaction[]} tx - The transaction, or an array of multiple transactions to send in batch.
     * @param {Pick<EvmErc4337WalletPaymasterTokenConfig, 'isSponsored' | 'paymasterToken'> | Pick<EvmErc4337WalletSponsorshipPolicyConfig, 'isSponsored'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     */
    quoteSendTransaction(tx: EvmTransaction | EvmTransaction[], config?: Pick<EvmErc4337WalletPaymasterTokenConfig, "isSponsored" | "paymasterToken"> | Pick<EvmErc4337WalletSponsorshipPolicyConfig, "isSponsored">): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Quotes the costs of a transfer operation.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @param {Pick<EvmErc4337WalletPaymasterTokenConfig, 'isSponsored' | 'paymasterToken'> | EvmErc4337WalletSponsorshipPolicyConfig} [config] -  If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
     * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
     */
    quoteTransfer(options: TransferOptions, config?: Pick<EvmErc4337WalletPaymasterTokenConfig, "isSponsored" | "paymasterToken"> | EvmErc4337WalletSponsorshipPolicyConfig): Promise<Omit<TransferResult, "hash">>;
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
     * @returns {Promise<bigint>} - The allowance.
     */
    getAllowance(token: string, spender: string): Promise<bigint>;
    /**
     * Returns the safe's erc-4337 pack of the account.
     *
     * @protected
     * @returns {Promise<Safe4337Pack>} The safe's erc-4337 pack.
     */
    protected _getSafe4337Pack(): Promise<Safe4337Pack>;
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
export type UserOperationReceipt = import("@wdk-safe-global/relay-kit").UserOperationReceipt;
export type EvmTransaction = import("@tetherto/wdk-wallet-evm").EvmTransaction;
export type TransactionResult = import("@tetherto/wdk-wallet-evm").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet-evm").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet-evm").TransferResult;
export type EvmTransactionReceipt = import("@tetherto/wdk-wallet-evm").EvmTransactionReceipt;
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
     * - The url of the paymaster service.
     */
    paymasterUrl: string;
    /**
     * - The address of the paymaster smart contract.
     */
    paymasterAddress: string;
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
     * - Whether the transaction is sponsored.
     */
    isSponsored?: false;
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
     * - Whether the transaction is sponsored.
     */
    isSponsored: true;
    /**
     * - The sponsorship policy id.
     */
    sponsorshipPolicyId: string;
};
export type EvmErc4337WalletConfig = EvmErc4337WalletCommonConfig & (EvmErc4337WalletPaymasterTokenConfig | EvmErc4337WalletSponsorshipPolicyConfig);
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
import { Safe4337Pack } from '@wdk-safe-global/relay-kit';
import { GenericFeeEstimator } from '@wdk-safe-global/relay-kit';
