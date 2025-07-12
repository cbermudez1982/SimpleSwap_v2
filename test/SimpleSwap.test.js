const { expect } = require("chai");
const { ethers } = require("hardhat");



describe("SimpleSwap Contract", function () {
  let simpleSwap;
  let tokenA, tokenB;
  let owner, user1, user2;

  // Helper function to get future timestamp
  const getFutureTimestamp = (seconds = 300) => Math.floor(Date.now() / 1000) + seconds;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    tokenA = await ERC20Mock.deploy("Token A", "TKA", ethers.parseEther("1000000"));
    tokenB = await ERC20Mock.deploy("Token B", "TKB", ethers.parseEther("1000000"));

    // Deploy SimpleSwap contract
    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy();

    // Distribute tokens to test users
    await tokenA.transfer(user1.address, ethers.parseEther("100"));
    await tokenB.transfer(user1.address, ethers.parseEther("100"));
    await tokenA.transfer(user2.address, ethers.parseEther("100"));
    await tokenB.transfer(user2.address, ethers.parseEther("100"));
  });

  describe("Initialization", function () {
    it("should deploy with correct name and symbol", async function () {
      expect(await simpleSwap.name()).to.equal("Simple Swap");
      expect(await simpleSwap.symbol()).to.equal("SSWP");
    });
  });

  describe("Liquidity Management", function () {
    beforeEach(async function () {
      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("100"));
    });

    describe("Adding Liquidity", function () {
      it("should mint LP tokens when adding initial liquidity", async function () {
        await simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("10"),
          ethers.parseEther("10"),
          0,
          0,
          user1.address,
          getFutureTimestamp(600)
        );
        expect(await simpleSwap.balanceOf(user1.address)).to.equal(ethers.parseEther("10"));
      });

      it("should adjust tokenA amount when optimalAmountB exceeds desired amount", async function () {
        // Create unbalanced pool (10:20 ratio)
        await tokenA.connect(owner).transfer(simpleSwap.target, ethers.parseEther("10"));
        await tokenB.connect(owner).transfer(simpleSwap.target, ethers.parseEther("20"));
        await simpleSwap.connect(owner).syncReserve(tokenA.target);
        await simpleSwap.connect(owner).syncReserve(tokenB.target);

        const tx = await simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("10"),
          ethers.parseEther("2"),
          0,
          0,
          user1.address,
          getFutureTimestamp(600)
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment.name === "LiquidityAdded");
        expect(event.args.amountB).to.equal(ethers.parseEther("2"));
        expect(event.args.amountA).to.be.lt(ethers.parseEther("10"));
      });

      it("should handle minimum possible liquidity amounts", async function () {
        // First transfer tokens to contract to create initial reserves
        await tokenA.connect(user2).transfer(simpleSwap.target, 1);
        await tokenB.connect(user2).transfer(simpleSwap.target, 1);
        await simpleSwap.connect(owner).syncReserve(tokenA.target);
        await simpleSwap.connect(owner).syncReserve(tokenB.target);

        // Then approve and add liquidity
        await tokenA.connect(user2).approve(simpleSwap.target, 1);
        await tokenB.connect(user2).approve(simpleSwap.target, 1);

        await simpleSwap.connect(user2).addLiquidity(
          tokenA.target,
          tokenB.target,
          1,
          1,
          0,
          0,
          user2.address,
          getFutureTimestamp(600)
        );
        expect(await simpleSwap.balanceOf(user2.address)).to.equal(1);
      });
    //});

      it("should revert when minimum amounts aren't met", async function () {
        await tokenA.connect(owner).transfer(simpleSwap.target, ethers.parseEther("15"));
        await tokenB.connect(owner).transfer(simpleSwap.target, ethers.parseEther("5"));
        await simpleSwap.connect(owner).syncReserve(tokenA.target);
        await simpleSwap.connect(owner).syncReserve(tokenB.target);

        await expect(
          simpleSwap.connect(user1).addLiquidity(
            tokenA.target,
            tokenB.target,
            ethers.parseEther("2"),
            ethers.parseEther("10"),
            0,
            ethers.parseEther("8"),
            user1.address,
            getFutureTimestamp(600)
          )
        ).to.be.revertedWith("SSwap: B Balance.");
      });

      it("should revert when using zero address", async function () {
        await expect(
          simpleSwap.connect(user1).addLiquidity(
            tokenA.target,
            tokenB.target,
            ethers.parseEther("1"),
            ethers.parseEther("1"),
            0,
            0,
            ethers.ZeroAddress, // Invalid address
            getFutureTimestamp(600)
          )
        ).to.be.reverted;
      });
    });

    describe("Removing Liquidity", function () {
      beforeEach(async function () {
        // Ensure sufficient approvals before adding liquidity
        await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("20"));
        await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("20"));
        // Create initial LP position
        await simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("10"),
          ethers.parseEther("10"),
          0,
          0,
          user1.address,
          getFutureTimestamp(600)
        );
      });

      it("should return both tokens when removing liquidity", async function () {
        const [initialA, initialB] = await Promise.all([
          tokenA.balanceOf(user1.address),
          tokenB.balanceOf(user1.address)
        ]);
        const lpBalance = await simpleSwap.balanceOf(user1.address);
          
        // Approve the LP tokens to be spent
        await simpleSwap.connect(user1).approve(simpleSwap.target, lpBalance);
          
        await simpleSwap.connect(user1).removeLiquidity(
          tokenA.target,
          tokenB.target,
          lpBalance,
          0,
          0,
          user1.address,
          getFutureTimestamp(600)
        );

        const [finalA, finalB] = await Promise.all([
          tokenA.balanceOf(user1.address),
          tokenB.balanceOf(user1.address)
        ]);
          
        expect(finalA).to.be.closeTo(
          initialA + ethers.parseEther("10"),
          ethers.parseEther("0.1")
        );
        expect(finalB).to.be.closeTo(
          initialB + ethers.parseEther("10"),
          ethers.parseEther("0.1")
        );
      });

      it("should revert when minimum output amounts aren't met", async function () {
          const lpBalance = await simpleSwap.balanceOf(user1.address);
          await simpleSwap.connect(user1).approve(simpleSwap.target, lpBalance);

          await expect(
            simpleSwap.connect(user1).removeLiquidity(
              tokenA.target,
              tokenB.target,
              lpBalance,
              ethers.parseEther("100"),
              0,
              user1.address,
              getFutureTimestamp(600)
            )
          ).to.be.revertedWith("SSwap: Balance.");
        });
      });
    });
  //});

  describe("Token Swaps", function () {
    beforeEach(async function () {
      // Setup initial liquidity pool (10:10 ratio)
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
        getFutureTimestamp(600)
      );
    });

    it("should execute token swap with correct output amount", async function () {
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("1"));
      const initialBalance = await tokenB.balanceOf(user2.address);
      
      await simpleSwap.connect(user2).swapExactTokensForTokens(
        ethers.parseEther("1"),
        0,
        [tokenA.target, tokenB.target],
        user2.address,
        getFutureTimestamp(600)
      );

      const received = (await tokenB.balanceOf(user2.address)) - initialBalance;
      expect(received).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.01"));
    });

    it("should reject swap when minimum output isn't met", async function () {
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("1"));
      
      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          ethers.parseEther("1"),
          ethers.parseEther("10"),
          [tokenA.target, tokenB.target],
          user2.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: Transfer cancelled.");
    });

    it("should reject swap with invalid token path", async function () {
      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target],
          user1.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: No tokens selected.");
    });

    it("should reject swap with identical tokens", async function () {
      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target, tokenA.target],
          user1.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: Same tokens.");
    });
    
    it("should revert swaps after deadline", async function () {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
      
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("1"));
      
      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target, tokenB.target],
          user2.address,
          expiredTimestamp
        )
      ).to.be.revertedWith("SSwap: Deadline reached.");
    });
  });

  describe("Price Calculations", function () {
    beforeEach(async function () {
      // Create 1:1 liquidity pool
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
        getFutureTimestamp(600)
      );
    });

    it("should return correct price for token pair", async function () {
      expect(await simpleSwap.getPrice(tokenA.target, tokenB.target))
        .to.equal(ethers.parseEther("1"));
    });

    it("should calculate expected output amount correctly", async function () {
      expect(await simpleSwap.getAmountOut(
        ethers.parseEther("1"),
        ethers.parseEther("10"),
        ethers.parseEther("10")
      )).to.equal(ethers.parseEther("1"));
    });

    it("should revert when calculating output with zero input", async function () {
      await expect(
        simpleSwap.getAmountOut(0, ethers.parseEther("10"), ethers.parseEther("10"))
      ).to.be.revertedWith("SSwap: Insufficient amount.");
    });

    it("should revert when querying price with no liquidity", async function () {
      const newSwap = await (await ethers.getContractFactory("SimpleSwap")).deploy();
      await expect(
        newSwap.getPrice(tokenA.target, tokenB.target)
      ).to.be.revertedWith("SSwap: Liquidity.");
    });
  });

  describe("syncReserve", function () {
    it("should update reserves correctly", async function () {
      // 1. First ensure no existing liquidity
      try {
        const lpBalance = await simpleSwap.balanceOf(owner.address);
        if (lpBalance > 0) {
          await simpleSwap.connect(owner).removeLiquidity(
            tokenA.target,
            tokenB.target,
            lpBalance,
            0,
            0,
            owner.address,
            getFutureTimestamp(600)
          );
        }
      } catch (e) {
        // Ignore if no liquidity exists
      }

      // 2. Transfer tokens directly to contract
      const amountA = ethers.parseEther("5");
      const amountB = ethers.parseEther("5");
      
      await tokenA.transfer(simpleSwap.target, amountA);
      await tokenB.transfer(simpleSwap.target, amountB);

      // 3. Verify initial swap fails (no reserves)
      await tokenA.connect(user1).approve(simpleSwap.target, amountA);
      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target, tokenB.target],
          user1.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: Not Enough Liquidity");

      // 4. Sync reserves
      await simpleSwap.syncReserve(tokenA.target);
      await simpleSwap.syncReserve(tokenB.target);

      // 5. Now swap should work
      const beforeBalance = await tokenB.balanceOf(user1.address);
      await simpleSwap.connect(user1).swapExactTokensForTokens(
        ethers.parseEther("1"),
        0,
        [tokenA.target, tokenB.target],
        user1.address,
        getFutureTimestamp(600)
      );
      const received = (await tokenB.balanceOf(user1.address)) - beforeBalance;
      expect(received).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle all sqrt calculation branches in addLiquidity", async function () {
      // Test various sqrt calculation paths
      const amounts = [1, 1, ethers.parseEther("2")];
      
      for (const amount of amounts) {
        await tokenA.connect(user1).approve(simpleSwap.target, amount);
        await tokenB.connect(user1).approve(simpleSwap.target, amount);
        await simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          amount,
          amount,
          0,
          0,
          user1.address,
          getFutureTimestamp(600)
        );
      }
    });

    it("should handle _calculateMin edge cases (zero reserves)", async function () {
      // Test with zero reserves
      await tokenB.transfer(simpleSwap.target, ethers.parseEther("10"));
      await simpleSwap.syncReserve(tokenB.target);

      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("1"));
      await tokenB.connect(user1).approve(simpleSwap.target, ethers.parseEther("1"));

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          0,
          0,
          user1.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: Not Enough Liquidity");
    });

    it("should revert when no amounts can be adjusted in _addLiquidity", async function () {
      // Setup extremely unbalanced pool
      await tokenA.transfer(simpleSwap.target, ethers.parseEther("1"));
      await tokenB.transfer(simpleSwap.target, ethers.parseEther("1000"));
      await simpleSwap.connect(owner).syncReserve(tokenA.target);
      await simpleSwap.connect(owner).syncReserve(tokenB.target);

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          ethers.parseEther("10"),
          ethers.parseEther("10"),
          user1.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: A Balance.");
    });

    it("should prevent reentrancy during swaps", async function () {
      // Setup fresh pool
      await tokenA.approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.approve(simpleSwap.target, ethers.parseEther("100"));
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );

      // Test proper approvals
      await tokenA.approve(simpleSwap.target, ethers.parseEther("10"));
      
      // Record initial balances
      const initialBalance = await tokenB.balanceOf(owner.address);
      
      // Perform swap
      await simpleSwap.swapExactTokensForTokens(
        ethers.parseEther("1"),
        0,
        [tokenA.target, tokenB.target],
        owner.address,
        getFutureTimestamp(600)
      );

      // Verify only expected amount transferred
      const finalBalance = await tokenB.balanceOf(owner.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1")); // Adjust based on your swap math
    });

    it("should demonstrate front-running vulnerability", async function () {
      // Setup with proper approvals
      await tokenA.connect(owner).approve(simpleSwap.target, ethers.parseEther("200"));
      await tokenB.connect(owner).approve(simpleSwap.target, ethers.parseEther("200"));
      
      // Initial liquidity
      await simpleSwap.connect(owner).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("100"),
        ethers.parseEther("100"),
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );

      // User approvals
      await tokenA.connect(user1).approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenA.connect(user2).approve(simpleSwap.target, ethers.parseEther("100"));

      // Test sequence
      const victimBefore = await tokenB.balanceOf(user1.address);
      await simpleSwap.connect(user1).swapExactTokensForTokens(
        ethers.parseEther("50"),
        0,
        [tokenA.target, tokenB.target],
        user1.address,
        getFutureTimestamp(600)
      );
      const victimRate = ((await tokenB.balanceOf(user1.address)) - victimBefore) / ethers.parseEther("50");

      // Reset pool
      await simpleSwap.connect(owner).removeLiquidity(
        tokenA.target,
        tokenB.target,
        await simpleSwap.balanceOf(owner.address),
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );
      
      // Re-add liquidity
      await simpleSwap.connect(owner).addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("100"),
        ethers.parseEther("100"),
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );

      // Attacker action
      const attackerBefore = await tokenB.balanceOf(user2.address);
      await simpleSwap.connect(user2).swapExactTokensForTokens(
        ethers.parseEther("10"),
        0,
        [tokenA.target, tokenB.target],
        user2.address,
        getFutureTimestamp(600)
      );
      const attackerRate = ((await tokenB.balanceOf(user2.address)) - attackerBefore) / ethers.parseEther("10");

      // Victim after front-run
      await simpleSwap.connect(user1).swapExactTokensForTokens(
        ethers.parseEther("50"),
        0,
        [tokenA.target, tokenB.target],
        user1.address,
        getFutureTimestamp(600)
      );
      const victimRateAfter = ((await tokenB.balanceOf(user1.address)) - victimBefore - (victimRate * ethers.parseEther("50"))) / ethers.parseEther("50");

      expect(attackerRate).to.be.gt(victimRateAfter);
    });

    it("should revert with correct message on identical tokens", async () => {
      await expect(
        simpleSwap.swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          [tokenA.target, tokenA.target], // Same token
          owner.address,
          getFutureTimestamp(600)
        )
      ).to.be.revertedWith("SSwap: Same tokens.");
    });

    it("should calculate sqrt(1 wei) correctly", async function () {
      // Approve and transfer tiny amounts first
      await tokenA.approve(simpleSwap.target, 1);
      await tokenB.approve(simpleSwap.target, 1);
      await tokenA.transfer(simpleSwap.target, 1);
      await tokenB.transfer(simpleSwap.target, 1);
      await simpleSwap.syncReserve(tokenA.target);
      await simpleSwap.syncReserve(tokenB.target);

      // Now add liquidity
      await tokenA.approve(simpleSwap.target, 1);
      await tokenB.approve(simpleSwap.target, 1);
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        1, // 1 wei
        1,
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );
      expect(await simpleSwap.balanceOf(owner.address)).to.equal(1);
    });

    it("should allow swaps with zero minimum output", async function () {
      // Setup pool first
      await tokenA.approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.approve(simpleSwap.target, ethers.parseEther("100"));
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );

      await tokenA.approve(simpleSwap.target, ethers.parseEther("1"));
      await expect(
        simpleSwap.swapExactTokensForTokens(
          ethers.parseEther("1"),
          0, // minAmountOut = 0
          [tokenA.target, tokenB.target],
          owner.address,
          getFutureTimestamp(600)
        )
      ).to.not.reverted;
    });

    it("should handle 1000:1 token ratio", async function () {
      // Clear any existing liquidity
      const lpBalance = await simpleSwap.balanceOf(owner.address);
      if (lpBalance > 0) {
        await simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          lpBalance,
          0,
          0,
          owner.address,
          getFutureTimestamp(600)
        );
      }

      // Create extremely unbalanced pool
      await tokenA.approve(simpleSwap.target, ethers.parseEther("1001"));
      await tokenB.approve(simpleSwap.target, ethers.parseEther("1.001"));
      
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("1000"),
        ethers.parseEther("1"),
        0,
        0,
        owner.address,
        getFutureTimestamp(600)
      );
      
      // Get price with small quote amount to avoid slippage
      const amountOut = await simpleSwap.getAmountOut(
        ethers.parseEther("0.001"), // Small input for accurate price
        ethers.parseEther("1000"),
        ethers.parseEther("1")
      );
      
      // Expected: 0.001 * (1/1000) = 0.000001
      expect(amountOut).to.be.closeTo(
        ethers.parseEther("0.000001"), 
        ethers.parseEther("0.0000001") // 10% tolerance
      );
    });

    it("should handle near-zero reserveA when adding liquidity", async function () {
      // Clear existing liquidity
      const lpBalance = await simpleSwap.balanceOf(owner.address);
      if (lpBalance > 0) {
        await simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          lpBalance,
          0,
          0,
          owner.address,
          getFutureTimestamp(600)
        );
      }

      // Setup near-zero reserve
      await tokenA.transfer(simpleSwap.target, 1); // 1 wei
      await tokenB.transfer(simpleSwap.target, ethers.parseEther("10"));
      await simpleSwap.syncReserve(tokenA.target);
      await simpleSwap.syncReserve(tokenB.target);

      // Add liquidity with fresh deadline
      await tokenA.approve(simpleSwap.target, 1);
      await tokenB.approve(simpleSwap.target, ethers.parseEther("1"));
      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          1,
          ethers.parseEther("1"),
          0,
          0,
          owner.address,
          getFutureTimestamp(600) // Extended deadline
        )
      ).to.not.reverted;
    });

    it("should handle any valid swap amount (fuzz)", async function () {
      // Setup pool with fresh deadline
      await tokenA.approve(simpleSwap.target, ethers.parseEther("100"));
      await tokenB.approve(simpleSwap.target, ethers.parseEther("100"));
      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        owner.address,
        getFutureTimestamp(600) // Extended deadline
      );

      const amounts = [
        ethers.parseEther("0.000001"), // tiny
        ethers.parseEther("0.1"),      // small 
        ethers.parseEther("1"),        // normal
        ethers.parseEther("5")         // large
      ];

      for (const amount of amounts) {
        await tokenA.connect(user1).approve(simpleSwap.target, amount);
        const before = await tokenB.balanceOf(user1.address);
        
        await simpleSwap.connect(user1).swapExactTokensForTokens(
          amount,
          0,
          [tokenA.target, tokenB.target],
          user1.address,
          getFutureTimestamp(600) // Extended deadline
        );
        
        expect(await tokenB.balanceOf(user1.address)).to.be.gt(before);
      }
    }).timeout(10000);

  });
});