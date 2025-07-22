import WalletAccountEvmErc4337 from './wallet-account-evm-erc-4337.js';
import { EvmTransaction, TransferOptions, TransferResult, TransactionResult } from '@wdk/wallet-evm';
import { EvmErc4337WalletConfig } from './wallet-account-evm-erc-4337';

export default class WalletAccountReadOnlyEvmErc4337 extends WalletAccountEvmErc4337 {
    /**
     * Creates a new read-only EVM ERC-4337 wallet account.
     * 
     * @param {string} address - The wallet's address.
     * @param {EvmErc4337WalletConfig} [config] - The configuration object.
     */
    constructor(address: string, config?: EvmErc4337WalletConfig);

    /**
     * The wallet's address.
     * 
     * @protected
     * @type {string}
     */
    protected _address: string;

    /**
     * Returns the account's address.
     * 
     * @returns {Promise<string>} The account's address.
     */
    getAddress(): Promise<string>;

    /**
     * Signs a message. This operation is not supported for read-only accounts.
     * 
     * @param {string} message - The message to sign.
     * @throws {Error} Always throws an error as signing is not supported.
     */
    sign(message: string): Promise<never>;

    /**
     * Verifies a message's signature.
     * 
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid and matches this account's address.
     */
    verify(message: string, signature: string): Promise<boolean>;

    /**
     * Sends a transaction. This operation is not supported for read-only accounts.
     * 
     * @param {EvmTransaction} tx - The transaction.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
     * @throws {Error} Always throws an error as sending transactions is not supported.
     */
    sendTransaction(tx: EvmTransaction, config?: Pick<EvmErc4337WalletConfig, 'paymasterToken'>): Promise<never>;

    /**
     * Quotes the costs of a send transaction operation.
     * 
     * @param {EvmTransaction} tx - The transaction.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     */
    quoteSendTransaction(tx: EvmTransaction, config?: Pick<EvmErc4337WalletConfig, 'paymasterToken'>): Promise<Omit<TransactionResult, 'hash'>>;

    /**
     * Transfers tokens. This operation is not supported for read-only accounts.
     * 
     * @param {TransferOptions} options - The transfer's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken' | 'transferMaxFee'>} [config] - If set, overrides the 'paymasterToken' and 'transferMaxFee' options defined in the wallet account configuration.
     * @throws {Error} Always throws an error as transferring tokens is not supported.
     */
    transfer(options: TransferOptions, config?: Pick<EvmErc4337WalletConfig, 'paymasterToken' | 'transferMaxFee'>): Promise<never>;

    /**
     * Quotes the costs of a transfer operation.
     * 
     * @param {TransferOptions} options - The transfer's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] -  If set, overrides the 'paymasterToken' option defined in the wallet account configuration.
     * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
     */
    quoteTransfer(options: TransferOptions, config?: Pick<EvmErc4337WalletConfig, 'paymasterToken'>): Promise<Omit<TransferResult, 'hash'>>;
} 