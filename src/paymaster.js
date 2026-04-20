// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

import { Erc7677Paymaster } from 'abstractionkit'

export const PaymasterMode = Object.freeze({
  NATIVE: 'native',
  SPONSORED: 'sponsored',
  TOKEN: 'token'
})

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
 * @param {Object} args
 * @param {string} args.mode - PaymasterMode value.
 * @param {Object} args.smartAccount - AbstractionKit SafeAccountV0_3_0 instance.
 * @param {Object} args.userOp - The fully-estimated user operation.
 * @param {Object} args.config - The wallet configuration.
 * @param {bigint} args.chainId - The chain id.
 * @returns {Promise<Object>} The user operation with paymaster fields populated.
 */
export async function applyPaymasterToUserOp ({ mode, smartAccount, userOp, config, chainId }) {
  if (mode === PaymasterMode.NATIVE) return userOp

  const erc7677 = new Erc7677Paymaster(config.paymasterUrl, { chainId: BigInt(chainId) })

  const context = mode === PaymasterMode.TOKEN
    ? { token: config.paymasterToken.address }
    : (config.sponsorshipPolicyId ? { sponsorshipPolicyId: config.sponsorshipPolicyId } : {})

  return await erc7677.createPaymasterUserOperation(
    smartAccount,
    userOp,
    config.bundlerUrl,
    context,
    { entrypoint: config.entryPointAddress }
  )
}

export function resolvePaymasterMode (config) {
  if (config.useNativeCoins) return PaymasterMode.NATIVE
  if (config.isSponsored) return PaymasterMode.SPONSORED
  return PaymasterMode.TOKEN
}

/**
 * @typedef {Object} BundlerGasPrice
 * @property {bigint} maxFeePerGas - The maximum fee per gas unit.
 * @property {bigint} maxPriorityFeePerGas - The maximum priority fee per gas unit.
 */

/**
 * Fetches bundler-specific gas prices when the bundler requires them.
 * Currently only Pimlico requires this (pimlico_getUserOperationGasPrice).
 * Other bundlers (Candide, etc.) work with standard node RPC gas prices.
 *
 * @param {string} bundlerUrl - The bundler RPC URL.
 * @returns {Promise<BundlerGasPrice | undefined>}
 */
export async function fetchBundlerGasPrice (bundlerUrl) {
  if (Erc7677Paymaster.detectProvider(bundlerUrl) !== 'pimlico') return undefined

  const erc7677 = new Erc7677Paymaster(bundlerUrl)
  const result = await erc7677.sendRPCRequest('pimlico_getUserOperationGasPrice', [])
  if (!result?.fast) return undefined

  return {
    maxFeePerGas: BigInt(result.fast.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(result.fast.maxPriorityFeePerGas)
  }
}
