// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

'use strict'

// eslint-disable-next-line camelcase
import { SafeAccountV0_3_0 as SafeAccount030 } from 'abstractionkit'
import { secp256k1 } from '@noble/curves/secp256k1'
import { getBytes, hexlify, zeroPadValue, toBeHex } from 'ethers'

/**
 * Signs an AbstractionKit UserOperation using the owner's private key bytes.
 * The private key stays as a Uint8Array end-to-end — never converted to string —
 * so dispose() can still zero it out of memory.
 *
 * @param {object} args
 * @param {object} args.userOp - The user operation to sign.
 * @param {Uint8Array} args.privateKeyBytes - The owner's 32-byte private key.
 * @param {string} args.ownerAddress - The owner's EOA address.
 * @param {bigint} args.chainId - The target chain id.
 * @param {string} args.entrypointAddress - The EntryPoint contract address.
 * @param {string} [args.safe4337ModuleAddress] - The Safe 4337 module address (defaults to AK v0.3.0).
 * @returns {string} The formatted Safe 4337 user operation signature.
 */
export function signUserOperationWithKeyBytes ({
  userOp,
  privateKeyBytes,
  ownerAddress,
  chainId,
  entrypointAddress,
  safe4337ModuleAddress
}) {
  if (!privateKeyBytes) {
    throw new Error('Private key has been disposed.')
  }

  const eip712Hash = SafeAccount030.getUserOperationEip712Hash(userOp, chainId, {
    entrypointAddress,
    safe4337ModuleAddress
  })

  const signatureHex = _signHashBytes(eip712Hash, privateKeyBytes)

  return SafeAccount030.formatSignaturesToUseroperationSignature(
    [{ signer: ownerAddress, signature: signatureHex }],
    {}
  )
}

/**
 * Produces a 65-byte ECDSA signature (r || s || v) over a 32-byte hash.
 * Uses @noble/curves so the private key remains a Uint8Array.
 *
 * @param {string} hashHex
 * @param {Uint8Array} privateKeyBytes
 * @returns {string}
 */
function _signHashBytes (hashHex, privateKeyBytes) {
  const hashBytes = getBytes(hashHex)
  const { r, s, recovery } = secp256k1.sign(hashBytes, privateKeyBytes, {
    lowS: true,
    extraEntropy: false
  })
  const rHex = zeroPadValue(toBeHex(r), 32)
  const sHex = zeroPadValue(toBeHex(s), 32)
  const v = recovery === 1 ? '1c' : '1b'
  return hexlify(rHex) + sHex.slice(2) + v
}
