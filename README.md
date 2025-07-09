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
> - Address: `0x38b6E4b23dd859E73d5708a940A4CA02ADE06Ce4`

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

## 📦 Useful Scripts

- `deploy.js`: manual deployment script (optional)
- `scripts/`: includes a simple frontend or interaction examples (in progress)

## 🖥️ Frontend

A basic web frontend using `ethers.js` is under development to interact with the contract.

## 📄 License

MIT © Carlos Bermúdez

---

## 📬 Contact

> For questions, suggestions or contributions, feel free to open an issue or a pull request!
