const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap", function () {
  let simpleSwap;
  let tokenA, tokenB;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Desplegar ERC20 Mocks
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    tokenA = await ERC20Mock.deploy("Token A", "TKA", ethers.parseEther("1000"));
    tokenB = await ERC20Mock.deploy("Token B", "TKB", ethers.parseEther("1000"));

    // Desplegar SimpleSwap
    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy();

    // Transferir tokens a usuarios
    await tokenA.transfer(user1.address, ethers.parseEther("100"));
    await tokenB.transfer(user1.address, ethers.parseEther("100"));
    await tokenA.transfer(user2.address, ethers.parseEther("100"));
    await tokenB.transfer(user2.address, ethers.parseEther("100"));
  });

  describe("Configuración Inicial", function () {
    it("debería desplegarse correctamente", async function () {
      expect(await simpleSwap.name()).to.equal("Simple Swap");
      expect(await simpleSwap.symbol()).to.equal("SSWP");
    });
  });

  describe("Agregar Liquidez", function () {
    beforeEach(async function () {
      // Configuración común para pruebas de liquidez
      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.connect(user2).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenA.connect(owner).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.connect(owner).approve(simpleSwap.target, ethers.parseEther("100"));
    });

    it("debería agregar liquidez por primera vez", async function () {
      const tx = await simpleSwap.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 300
      );

      const lpBalance = await simpleSwap.balanceOf(user1.address);
      expect(lpBalance).to.equal(ethers.parseEther("10"));
    });
    
    it("debería manejar optimalAmountB > amountBDesired", async function () {
      const amountADesired = ethers.parseEther("10");
      const amountBDesired = ethers.parseEther("2"); // menor a optimal B

      // Añadir reservas iniciales para crear relación desigual
      await tokenA.connect(owner).transfer(simpleSwap.target, ethers.parseEther("10"));
      await tokenB.connect(owner).transfer(simpleSwap.target, ethers.parseEther("20"));
      await simpleSwap.connect(owner).syncReserve(tokenA.target);
      await simpleSwap.connect(owner).syncReserve(tokenB.target);

      const amountAMin = ethers.parseEther("0"); // no importa para este test
      const amountBMin = ethers.parseEther("0");

      const tx = await simpleSwap.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        user1.address,
        Math.floor(Date.now() / 1000) + 300
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment.name === "LiquidityAdded");
      const usedAmountA = event.args.amountA;
      const usedAmountB = event.args.amountB;

      // En este escenario, optimalAmountB > amountBDesired, entonces se debería usar optimalAmountA
      // Entonces amountB usado debe ser igual a amountBDesired
      expect(usedAmountB).to.equal(amountBDesired);

      // Verificamos que amountA fue reducido desde amountADesired
      expect(usedAmountA).to.be.lt(amountADesired);
    });


    it("debería manejar correctamente valores pequeños en addLiquidity", async function () {
      // Configurar reservas iniciales
      await tokenA.connect(user2).transfer(simpleSwap.target, ethers.parseEther("0.0001"));
      await tokenB.connect(user2).transfer(simpleSwap.target, ethers.parseEther("0.0001"));
      await simpleSwap.connect(owner).syncReserve(tokenA.target);
      await simpleSwap.connect(owner).syncReserve(tokenB.target);

      await simpleSwap.connect(user2).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("0.0001"),
        ethers.parseEther("0.0001"),
        0,
        0,
        user2.address,
        Math.floor(Date.now() / 1000) + 300
      );

      const lpBalance = await simpleSwap.balanceOf(user2.address);
      expect(lpBalance).to.equal(ethers.parseEther("0.0001"));
    });

    it("debería revertir si amountAMin no se cumple", async function () {
      // Reservas desbalanceadas para forzar path de optimalAmountA
      await tokenA.connect(owner).transfer(simpleSwap.target, ethers.parseEther("5"));
      await tokenB.connect(owner).transfer(simpleSwap.target, ethers.parseEther("15"));
      await simpleSwap.connect(owner).syncReserve(tokenA.target);
      await simpleSwap.connect(owner).syncReserve(tokenB.target);

      const amountADesired = ethers.parseEther("10");  // alto
      const amountBDesired = ethers.parseEther("2");   // bajo

      const amountAMin = ethers.parseEther("8");       // muy alto, debería fallar
      const amountBMin = ethers.parseEther("0");

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          user1.address,
          Math.floor(Date.now() / 1000) + 300
        )
      ).to.be.revertedWith("SSwap: A Balance.");
    });

  });

  describe("Swap de Tokens", function () {
    beforeEach(async function () {
      // Configurar liquidez para swaps
      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("20"));
      await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("20"));
      
      await simpleSwap.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 300
      );
    });

    it("debería realizar un swap correctamente", async function () {
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("1"));
      const path = [tokenA.target, tokenB.target];

      const initialBalanceB = await tokenB.balanceOf(user2.address);
      
      await simpleSwap.connect(user2).swapExactTokensForTokens(
        ethers.parseEther("1"),
        0,
        path,
        user2.address,
        Math.floor(Date.now() / 1000) + 300
      );

      const finalBalanceB = await tokenB.balanceOf(user2.address);
      expect(finalBalanceB - initialBalanceB).to.be.closeTo(
        ethers.parseEther("1"), 
        ethers.parseEther("0.01")
      );
    });
  });

  describe("Remover Liquidez", function () {
    beforeEach(async function () {
      // Configurar liquidez inicial
      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("10"));
      await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("10"));
      
      await simpleSwap.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 300
      );
    });

    it("debería remover liquidez correctamente", async function () {
      const initialBalanceA = await tokenA.balanceOf(user1.address);
      const initialBalanceB = await tokenB.balanceOf(user1.address);
      const lpBalance = await simpleSwap.balanceOf(user1.address);
      
      await simpleSwap.connect(user1).approve(simpleSwap.target, lpBalance);

      await simpleSwap.connect(user1).removeLiquidity(
        tokenA.target,
        tokenB.target,
        lpBalance,
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 300
      );

      expect(await tokenA.balanceOf(user1.address)).to.be.closeTo(
        initialBalanceA + ethers.parseEther("10"),
        ethers.parseEther("0.1")
      );
      expect(await tokenB.balanceOf(user1.address)).to.be.closeTo(
        initialBalanceB + ethers.parseEther("10"),
        ethers.parseEther("0.1")
      );
    });
  });

  describe("Consultas", function () {
    beforeEach(async function () {
      // Configurar liquidez para consultas
      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("10"));
      await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("10"));
      
      await simpleSwap.connect(user1).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 300
      );
    });

    it("debería obtener el precio correcto", async function () {
      const price = await simpleSwap.getPrice(tokenA.target, tokenB.target);
      expect(price).to.equal(ethers.parseEther("1"));
    });

    it("debería calcular amountOut correctamente", async function () {
      const amountOut = await simpleSwap.getAmountOut(
        ethers.parseEther("1"),
        ethers.parseEther("10"),
        ethers.parseEther("10")
      );
      expect(amountOut).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Casos Extremos", function () {
    beforeEach(async function () {
      // Aprobar tokens para casos extremos
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("1"));
      await tokenB.connect(user2).approve(simpleSwap.target, ethers.parseEther("1"));
    });

    it("debería manejar depositos mínimos", async function () {
      // Transferir tokens mínimos al contrato primero
      await tokenA.connect(user2).transfer(simpleSwap.target, 1);
      await tokenB.connect(user2).transfer(simpleSwap.target, 1);
      await simpleSwap.connect(owner).syncReserve(tokenA.target);
      await simpleSwap.connect(owner).syncReserve(tokenB.target);

      await simpleSwap.connect(user2).addLiquidity(
        tokenA.target,
        tokenB.target,
        1,
        1,
        0,
        0,
        user2.address,
        Math.floor(Date.now() / 1000) + 300
      );

      const lpBalance = await simpleSwap.balanceOf(user2.address);
      expect(lpBalance).to.equal(1);
    });

    it("debería revertir si no hay liquidez en getAmountOut", async function () {
      await expect(
        simpleSwap.getAmountOut(
          ethers.parseEther("1"),
          0,
          0
        )
      ).to.be.revertedWith("SSwap: Not Enough Liquidity");
    });
  });

  describe("Edge Cases de Swaps", function () {
    it("debería revertir si path.length != 2", async function () {
      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target],
          user1.address,
          Math.floor(Date.now() / 1000) + 300
        )
      ).to.be.revertedWith("SSwap: No tokens selected.");
    });

    it("debería revertir si se intenta swap con los mismos tokens", async function () {
      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target, tokenA.target],
          user1.address,
          Math.floor(Date.now() / 1000) + 300
        )
      ).to.be.revertedWith("SSwap: Same tokens.");
    });
  });
});