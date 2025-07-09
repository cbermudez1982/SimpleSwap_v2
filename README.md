# SimpleSwap v2

SimpleSwap is a smart contract written in Solidity that implements a simple decentralized exchange (DEX) for ERC20 tokens. It allows users to add and remove liquidity, and swap between two tokens. It's ideal for educational purposes or as a base for custom DEX testing.

## ✨ Features

- Add and remove liquidity.
- Token swaps using internal reserves.
- Compatible with any ERC20 token pair.
- No fees.
- Built with [Hardhat](https://hardhat.org/) and deployed using [Hardhat Ignition](https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-ignition).

## 🧱 Project Structure

```
SimpleSwap_v2/
├── contracts/             # Solidity contracts (SimpleSwap and ERC20Mock)
├── deployments/           # Ignition deployment scripts
├── scripts/               # JS scripts (frontend or interactions)
├── test/                  # Unit tests using Hardhat + Chai
├── hardhat.config.js      # Hardhat configuration
└── README.md              # This file
```

## 🚀 Deployment

This project uses **Hardhat Ignition** to deploy smart contracts. Make sure you have an account with funds on the target network (e.g., Sepolia).

```bash
npx hardhat ignition deploy ignition/modules/SimpleSwap.js --network sepolia
```

> 🔍 Contract deployed on Sepolia:
> - Address: [0xe30Ad4daFB933547Fe3e68ea4e3dB8416CDEEf82](https://sepolia.etherscan.io/address/0xe30Ad4daFB933547Fe3e68ea4e3dB8416CDEEf82)

> 🔍 Token Contracts deployed on Sepolia:
> - Address: [0xf367150C56b9c8C14db60914C82D1b278cfA7A6D](https://sepolia.etherscan.io/address/0xf367150C56b9c8C14db60914C82D1b278cfA7A6D)
> - Address: [0x1Fd59a58510686a2d6029A8D27F66Fdc68360ed1](https://sepolia.etherscan.io/address/0x1Fd59a58510686a2d6029A8D27F66Fdc68360ed1)
> - Tokens Have a public mint function for testing purposes

> 🔍 Deployed simple FrontEnd for Testing:
> - Address: [SimpleSwap](https://cbermudez1982.github.io/index.html)

## 🧪 Testing

Unit tests are implemented with Hardhat and Chai to validate contract functionality:

```bash
npx hardhat test
```

Test coverage includes:

- Adding/removing liquidity
- Swapping tokens
- Edge cases (slippage, zero liquidity)
- Error validations (invalid token, insufficient balance, etc.)

## 🔗 Dependencies

- Solidity `^0.8.27`
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
- Hardhat + Ethers + Chai
- Hardhat Ignition

Install project dependencies:

```bash
npm install
```

## 🖥️ Frontend

A basic web frontend using `ethers.js` is under development to interact with the contract.

## 📄 License

MIT © Carlos Bermúdez

---

## 📬 Contact

> For questions, suggestions or contributions, feel free to open an issue or a pull request!
