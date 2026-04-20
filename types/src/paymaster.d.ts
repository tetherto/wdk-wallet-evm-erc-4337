/**
 * Applies paymaster fields to a fully-estimated UserOperation via
 * Erc7677Paymaster. Works with any ERC-7677 provider (Candide, Pimlico,
 * Alchemy, etc.) — provider detection and token flow handled by AK.
 *
 * The base userOp must already have gas limits and gas prices populated
 * by createUserOperation (with bundlerRpc). For bundlers that require
 * specific gas prices (e.g. Pimlico), pass them as overrides to
 * createUserOperation before calling this function.
 *
 * @param {object} args
 * @param {string} args.mode - PaymasterMode value.
 * @param {object} args.smartAccount - AbstractionKit SafeAccountV0_3_0 instance.
 * @param {object} args.userOp - The fully-estimated user operation.
 * @param {object} args.config - The wallet configuration.
 * @param {bigint} args.chainId - The chain id.
 * @returns {Promise<object>} The user operation with paymaster fields populated.
 */
export function applyPaymasterToUserOp({ mode, smartAccount, userOp, config, chainId }: {
    mode: string;
    smartAccount: object;
    userOp: object;
    config: object;
    chainId: bigint;
}): Promise<object>;
export function resolvePaymasterMode(config: any): "native" | "sponsored" | "token";
/**
 * Fetches bundler-specific gas prices when the bundler requires them.
 * Currently only Pimlico requires this (pimlico_getUserOperationGasPrice).
 * Other bundlers (Candide, etc.) work with standard node RPC gas prices.
 *
 * @param {string} bundlerUrl
 * @returns {Promise<{maxFeePerGas: bigint, maxPriorityFeePerGas: bigint} | undefined>}
 */
export function fetchBundlerGasPrice(bundlerUrl: string): Promise<{
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
} | undefined>;
export const PaymasterMode: Readonly<{
    NATIVE: "native";
    SPONSORED: "sponsored";
    TOKEN: "token";
}>;
