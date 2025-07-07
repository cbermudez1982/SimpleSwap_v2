const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SimpleSwapModule = buildModule("SimpleSwapModule", (m) => {
  const swap = m.contract("SimpleSwap", );

  return { swap };
});

module.exports = SimpleSwapModule;