# @tetherto/wdk-wallet-evm-erc-4337

[![npm version](https://img.shields.io/npm/v/%40tetherto%2Fwdk-wallet-evm-erc-4337?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk-wallet-evm-erc-4337)
[![npm downloads](https://img.shields.io/npm/dw/%40tetherto%2Fwdk-wallet-evm-erc-4337?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk-wallet-evm-erc-4337)
[![license](https://img.shields.io/npm/l/%40tetherto%2Fwdk-wallet-evm-erc-4337?style=flat-square)](https://github.com/tetherto/wdk-wallet-evm-erc-4337/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-docs.wdk.tether.io-0A66C2?style=flat-square)](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337)

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A simple and secure package to manage ERC-4337 compliant wallets for EVM-compatible blockchains. This package provides a clean API for creating, managing, and interacting with account abstraction wallets using BIP-39 seed phrases and EVM-specific derivation paths.

## About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://docs.wdk.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control.

For detailed documentation about the complete WDK ecosystem, visit [docs.wdk.tether.io](https://docs.wdk.tether.io).

## Installation

```bash
npm install @tetherto/wdk-wallet-evm-erc-4337
```

## Quick Start

```javascript
import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337'

const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const wallet = new WalletManagerEvmErc4337(seedPhrase, {
  chainId: 11155111, // Sepolia
  provider: 'https://sepolia.drpc.org',
  bundlerUrl: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY',
  entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  safeModulesVersion: '0.3.0',
  useNativeCoins: true,
})

const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Smart account address:', address)

wallet.dispose()
```

## Key Capabilities

- **ERC-4337 Account Abstraction**: Full implementation of the ERC-4337 standard
- **Multiple Gas Payment Modes**: Pay fees with native coins, ERC-20 tokens via paymaster, or sponsored transactions
- **UserOperation Management**: Create and send UserOperations through bundlers
- **BIP-44 Derivation Paths**: Standard Ethereum derivation (m/44'/60')
- **Multi-Account Management**: Derive multiple smart accounts from a single seed phrase
- **ERC-20 Token Support**: Query balances and transfer tokens via UserOperations
- **Message Signing**: Sign and verify messages with the underlying EOA key
- **Per-Call Config Overrides**: Switch gas payment modes on a per-transaction basis
- **Secure Memory Disposal**: Clear private keys from memory when done

## Compatibility

- **Ethereum Mainnet** and testnets (Sepolia)
- **Layer 2 Networks**: Arbitrum, Optimism, Base
- **Other EVM Chains**: Polygon, Avalanche C-Chain, and any EVM-compatible chain with ERC-4337 support

## Documentation

| Topic | Description | Link |
|-------|-------------|------|
| Overview | Module overview and feature summary | [Wallet EVM ERC-4337 Overview](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337) |
| Usage | End-to-end integration walkthrough | [Wallet EVM ERC-4337 Usage](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/usage) |
| Configuration | Provider, bundler, paymaster, and network setup | [Wallet EVM ERC-4337 Configuration](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/configuration) |
| API Reference | Complete class and type reference | [Wallet EVM ERC-4337 API Reference](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/api-reference) |

## Examples

| Example | Description |
|---------|-------------|
| [Create Wallet](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/create-wallet.ts) | Initialize ERC-4337 wallets with paymaster token and native coins modes |
| [Manage Accounts](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/manage-accounts.ts) | Work with multiple smart accounts and custom derivation paths |
| [Check Balances](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/check-balances.ts) | Query native token and ERC-20 balances for smart accounts |
| [Read-Only Account](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/read-only-account.ts) | Monitor smart account balances and estimate fees without a private key |
| [Send Transaction](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/send-transaction.ts) | Send transactions via UserOperations through the bundler |
| [Token Transfer](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/token-transfer.ts) | Transfer ERC-20 tokens via UserOperations with gas mode overrides |
| [Sign & Verify Message](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/sign-verify-message.ts) | Sign messages and verify signatures with ERC-4337 accounts |
| [Fee Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/fee-management.ts) | Retrieve current bundler fee rates |
| [Memory Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm-erc-4337/memory-management.ts) | Securely dispose smart wallets and clear private keys from memory |

> For detailed walkthroughs, see the [Usage Guide](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm-erc-4337/usage).
> See all runnable examples in the [wdk-examples](https://github.com/tetherto/wdk-examples) repository.

## Community

Join the [WDK Discord](https://discord.gg/arYXDhHB2w) to connect with other developers.

## Support

For support, please [open an issue](https://github.com/tetherto/wdk-wallet-evm-erc-4337/issues) on GitHub or reach out via [email](mailto:wallet-info@tether.io).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
