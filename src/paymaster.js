// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

import { Bundler, CandidePaymaster } from 'abstractionkit'
import { Interface } from 'ethers'

export const PaymasterProvider = Object.freeze({
  CANDIDE: 'candide',
  PIMLICO: 'pimlico'
})

export const PaymasterMode = Object.freeze({
  NATIVE: 'native',
  SPONSORED: 'sponsored',
  TOKEN: 'token'
})

const APPROVE_IFACE = new Interface(['function approve(address spender, uint256 amount)'])

// Dummy EOA signature used for bundler simulation when the userOp hasn't been
// signed yet. Sourced from AbstractionKit's EOADummySignerSignaturePair.
const DUMMY_EOA_SIGNATURE = '0x47003599ffa7e9198f321afa774e34a12a959844efd6363b88896e9c24ed33cf4e1be876ef123a3c4467e7d451511434039539699f2baa2f44955fa3d1c1c6d81c'

export function resolvePaymasterMode (config) {
  if (config.useNativeCoins) return PaymasterMode.NATIVE
  if (config.isSponsored) return PaymasterMode.SPONSORED
  return PaymasterMode.TOKEN
}

export function resolvePaymasterProvider (config) {
  if (typeof config.paymasterUrl === 'string' && config.paymasterUrl.includes('candide')) {
    return PaymasterProvider.CANDIDE
  }
  return PaymasterProvider.PIMLICO
}

export function buildApproveCalls (paymasterTokenAddress, paymasterAddress, amount) {
  return [
    {
      to: paymasterTokenAddress,
      value: 0n,
      data: APPROVE_IFACE.encodeFunctionData('approve', [paymasterAddress, 0n])
    },
    {
      to: paymasterTokenAddress,
      value: 0n,
      data: APPROVE_IFACE.encodeFunctionData('approve', [paymasterAddress, amount])
    }
  ]
}

/**
 * Applies paymaster fields to a base UserOperation (gas limits set to 0n).
 *
 * - Candide: delegates to AbstractionKit's CandidePaymaster, which runs its own
 *   stub → estimate → final pipeline internally.
 * - Pimlico: performs an ERC-7677 pm_getPaymasterStubData + manual gas
 *   estimation against the bundler + pm_getPaymasterData.
 *
 * @param {object} args
 * @param {string} args.provider
 * @param {string} args.mode
 * @param {object} args.smartAccount
 * @param {object} args.userOp
 * @param {object} args.config
 * @param {bigint} args.chainId
 * @param {number} [args.gasBufferPercent]
 * @returns {Promise<object>}
 */
export async function applyPaymasterToUserOp ({ provider, mode, smartAccount, userOp, config, chainId, gasBufferPercent = 0 }) {
  if (mode === PaymasterMode.NATIVE) return userOp

  if (provider === PaymasterProvider.CANDIDE) {
    const paymaster = new CandidePaymaster(config.paymasterUrl)
    if (mode === PaymasterMode.SPONSORED) {
      const [sponsored] = await paymaster.createSponsorPaymasterUserOperation(
        smartAccount,
        userOp,
        config.bundlerUrl,
        config.sponsorshipPolicyId
      )
      return _applyGasBuffer(sponsored, gasBufferPercent)
    }
    const withToken = await paymaster.createTokenPaymasterUserOperation(
      smartAccount,
      userOp,
      config.paymasterToken.address,
      config.bundlerUrl
    )
    return _applyGasBuffer(withToken, gasBufferPercent)
  }

  return await _applyPimlicoPaymasterFull({ mode, smartAccount, userOp, config, chainId, gasBufferPercent })
}

async function _applyPimlicoPaymasterFull ({ mode, smartAccount, userOp, config, chainId, gasBufferPercent }) {
  const chainIdHex = `0x${BigInt(chainId).toString(16)}`
  const context = mode === PaymasterMode.TOKEN
    ? { token: config.paymasterToken.address }
    : (config.sponsorshipPolicyId ? { sponsorshipPolicyId: config.sponsorshipPolicyId } : {})

  // Use a dummy EOA signature so bundler simulation of paymaster-enabled gas
  // estimation passes the Safe 4337 module's signature-format check.
  const signedForSim = { ...userOp, signature: DUMMY_EOA_SIGNATURE }

  const stub = await _jsonRpc(config.paymasterUrl, 'pm_getPaymasterStubData', [
    _encodeUserOpForRpc(signedForSim),
    config.entryPointAddress,
    chainIdHex,
    context
  ])
  const withStub = _mergePaymasterFields(signedForSim, stub)

  // Estimate gas through the bundler with the stub paymaster applied.
  // Don't zero maxFeePerGas / maxPriorityFeePerGas — Pimlico's singleton
  // paymaster computes token charges from them in postOp and reverts with
  // "divide by zero" when they are 0.
  const bundler = new Bundler(config.bundlerUrl)
  const forEstimate = {
    ...withStub,
    callGasLimit: 0n,
    verificationGasLimit: 0n,
    preVerificationGas: 0n
  }
  const estimation = await bundler.estimateUserOperationGas(forEstimate, config.entryPointAddress)
  const bumpPct = 100n + BigInt(gasBufferPercent || 0)
  const withGas = {
    ...withStub,
    preVerificationGas: BigInt(estimation.preVerificationGas) * bumpPct / 100n,
    verificationGasLimit: BigInt(estimation.verificationGasLimit) * bumpPct / 100n,
    callGasLimit: BigInt(estimation.callGasLimit) * bumpPct / 100n
  }

  if (stub?.isFinal === true) return withGas

  const final = await _jsonRpc(config.paymasterUrl, 'pm_getPaymasterData', [
    _encodeUserOpForRpc(withGas),
    config.entryPointAddress,
    chainIdHex,
    context
  ])
  return _mergePaymasterFields(withGas, final)
}

function _applyGasBuffer (userOp, bufferPct) {
  if (!bufferPct) return userOp
  const bumpPct = 100n + BigInt(bufferPct)
  return {
    ...userOp,
    callGasLimit: (userOp.callGasLimit || 0n) * bumpPct / 100n,
    verificationGasLimit: (userOp.verificationGasLimit || 0n) * bumpPct / 100n
  }
}

function _mergePaymasterFields (userOp, fields) {
  if (!fields) return userOp
  const next = { ...userOp }
  if (fields.paymaster != null) next.paymaster = fields.paymaster
  if (fields.paymasterData != null) next.paymasterData = fields.paymasterData
  if (fields.paymasterVerificationGasLimit != null) {
    next.paymasterVerificationGasLimit = BigInt(fields.paymasterVerificationGasLimit)
  }
  if (fields.paymasterPostOpGasLimit != null) {
    next.paymasterPostOpGasLimit = BigInt(fields.paymasterPostOpGasLimit)
  }
  return next
}

function _encodeUserOpForRpc (userOp) {
  const out = {
    sender: userOp.sender,
    nonce: _toHex(userOp.nonce),
    callData: userOp.callData,
    callGasLimit: _toHex(userOp.callGasLimit),
    verificationGasLimit: _toHex(userOp.verificationGasLimit),
    preVerificationGas: _toHex(userOp.preVerificationGas),
    maxFeePerGas: _toHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: _toHex(userOp.maxPriorityFeePerGas),
    signature: userOp.signature || '0x'
  }
  if (userOp.factory) out.factory = userOp.factory
  if (userOp.factoryData) out.factoryData = userOp.factoryData
  if (userOp.paymaster) out.paymaster = userOp.paymaster
  if (userOp.paymasterData) out.paymasterData = userOp.paymasterData
  if (userOp.paymasterVerificationGasLimit != null) {
    out.paymasterVerificationGasLimit = _toHex(userOp.paymasterVerificationGasLimit)
  }
  if (userOp.paymasterPostOpGasLimit != null) {
    out.paymasterPostOpGasLimit = _toHex(userOp.paymasterPostOpGasLimit)
  }
  return out
}

function _toHex (value) {
  if (value == null) return '0x0'
  if (typeof value === 'string') return value.startsWith('0x') ? value : `0x${BigInt(value).toString(16)}`
  return `0x${BigInt(value).toString(16)}`
}

/**
 * Returns the token exchange rate from the paymaster.
 *
 * @param {object} args
 * @param {string} args.provider
 * @param {string} args.tokenAddress
 * @param {string} args.paymasterUrl
 * @param {string} args.entryPointAddress
 * @param {bigint} args.chainId
 * @returns {Promise<bigint>}
 */
export async function getTokenExchangeRate ({ provider, tokenAddress, paymasterUrl, entryPointAddress, chainId }) {
  if (provider === PaymasterProvider.CANDIDE) {
    const paymaster = new CandidePaymaster(paymasterUrl)
    return await paymaster.fetchTokenPaymasterExchangeRate(tokenAddress, entryPointAddress)
  }

  const chainIdHex = `0x${BigInt(chainId).toString(16)}`
  const response = await _jsonRpc(paymasterUrl, 'pimlico_getTokenQuotes', [
    { tokens: [tokenAddress] },
    entryPointAddress,
    chainIdHex
  ])
  const quote = response?.quotes?.[0]
  if (!quote) throw new Error(`No exchange rate found for token: ${tokenAddress}`)
  return BigInt(quote.exchangeRate)
}

async function _jsonRpc (url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  })
  const json = await res.json()
  if (json.error) {
    const err = new Error(json.error.message || `${method} failed`)
    err.data = json.error.data
    throw err
  }
  return json.result
}
