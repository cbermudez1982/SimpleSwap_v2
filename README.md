# SimpleSwap_v2# SimpleSwap DEX

[![Solidity Version](https://img.shields.io/badge/Solidity-0.8.27-blue)](https://soliditylang.org)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A decentralized exchange (DEX) protocol implementing Automated Market Maker (AMM) functionality with comprehensive security features.

## Features

- 🔄 ERC-20 token swaps
- 💧 Add/remove liquidity
- 📊 Real-time price calculations
- 🛡️ Protection against:
  - Reentrancy attacks
  - Front-running
  - Excessive slippage

## Tech Stack

**Backend:**
- Solidity (0.8.27)
- Hardhat
- OpenZeppelin Contracts

**Frontend (Optional):**
- Ethers.js
- HTML
- CSS
- Javascript

## Project Structure

simple-swap/
├── contracts/          # Solidity contracts
├── test/               # Test files
├── scripts/            # Deployment scripts
├── frontend/           # React frontend (optional)
└── hardhat.config.js   # Configuration


## Getting Started

### Prerequisites
- Node.js (v16+)
- Yarn or npm

### Installation

### 1. Clone the repository
```bash
git clone https://github.com/cbermudez1982/SimpleSwap_v2.git
cd SimpleSwap_v2

### 2. Install Dependencies
```bash
npm install

### 3. Compile Contracts
```bash
npx hardhat compile

### 4. Run Tests
```bash
npx hardhat test

### 5. Simple Frontend 
```bash
Simple front end in FrontEnd Directory.


## Dependencies

### Core Dependencies (automatically installed with `npm install`)
| Package | Version | Purpose |
|---------|---------|---------|
| `hardhat` | ^2.12.0 | Ethereum development environment |
| `@openzeppelin/contracts` | ^5.0.0 | Secure smart contract libraries |
| `@nomicfoundation/hardhat-toolbox` | ^2.0.0 | Testing and deployment utilities |
| `@nomicfoundation/hardhat-network-helpers` | ^1.0.0 | Test helpers |


