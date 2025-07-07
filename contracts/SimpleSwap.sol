// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @author Carlos Bermudez
 * @title SimpleSwap
 * @dev A simple decentralized exchange (DEX) contract that supports swapping, adding, and removing liquidity for ERC20 tokens.
 *      The contract extends the ERC20 token standard, providing token functionality for liquidity pool tokens.
 *      It also includes the `ERC20Burnable` extension to allow burning of tokens and `Ownable` for access control.
 * 
 *      Key Features:
 *      - Allows users to add liquidity to a token pair (tokenA, tokenB) and receive liquidity tokens in return.
 *      - Allows users to remove liquidity and receive the underlying tokens (tokenA, tokenB).
 *      - Supports token swaps between a specified pair of ERC20 tokens.
 *      - Includes safety checks like ensuring sufficient liquidity, checking deadlines for time-sensitive operations, 
 *        and verifying that exactly two tokens are selected for swaps.
 *
 * @notice This contract is for creating a basic DEX (decentralized exchange) that supports liquidity provisioning and token swaps.
 */
contract SimpleSwap is ERC20, ERC20Burnable, ReentrancyGuard, Ownable {
   
    /**
     * @notice Tracks the internal token reserves held by the contract for each ERC20 token.
     * @dev Maps each token address to the amount currently held (as recorded by the contract).
     *      This reserve must be manually updated during token transfers in and out to maintain consistency.
     */
    mapping(address => uint256) public reserveOf;

    /**
    * @notice Ensures that the provided deadline is later than the current block timestamp.
    * @dev This modifier helps to enforce time-sensitive operations by checking if the given deadline has passed.
    *      If the deadline has passed, the transaction is reverted with a specific error message.
    * @param deadline The timestamp until which the operation is valid.
    */
    modifier checkDeadline(uint256 deadline) 
    {
        require(deadline > block.timestamp, "SSwap: Deadline reached.");
        _;
    }
    /**
    * @notice Ensures that both reserves (for token A and token B) are greater than zero.
    * @dev This modifier checks if the liquidity reserves for both tokens are available before proceeding with 
    *      any liquidity-related actions such as adding or removing liquidity.
    *      If either reserve is zero, the transaction is reverted with a specific error message.
    * @param _reserveA The current liquidity reserve of token A.
    * @param _reserveB The current liquidity reserve of token B.
    */
    modifier checkLiquidity(uint256 _reserveA, uint256 _reserveB) {
        require(_reserveA > 0 && _reserveB > 0, "SSwap: Not Enough Liquidity");
        _;
    }
    /**
    * @notice Ensures that exactly two tokens are selected for a given operation.
    * @dev This modifier checks that the `path` array contains exactly two token addresses, 
    *      as the swapping functionality is designed for two-token pairs. If the array does not have exactly two tokens, 
    *      the transaction is reverted with a specific error message.
    * @param path The array of token addresses selected for the operation.
    */
    modifier checkTokensSelected(address[] memory path) {
        require (path.length==2, "SSwap: No tokens selected.");
        _;
    }
    
    /**
    * @notice Emitted when liquidity is successfully added to the pool.
    * @dev Logs the provider's address and the amount of token A, token B, and liquidity tokens minted.
    * @param provider The address that added liquidity.
    * @param tokenA The address of token A.
    * @param tokenB The address of token B.
    * @param amountA Amount of token A deposited.
    * @param amountB Amount of token B deposited.
    * @param liquidity Amount of liquidity tokens minted.
    */
    event LiquidityAdded(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity);

    /**
    * @notice Emitted when liquidity is removed from the pool.
    * @dev Logs the provider's address and the amounts of tokens returned to the user.
    * @param provider The address that removed liquidity.
    * @param tokenA The address of token A.
    * @param tokenB The address of token B.
    * @param amountA Amount of token A withdrawn.
    * @param amountB Amount of token B withdrawn.
    * @param liquidity Amount of liquidity tokens burned.
    */
    event LiquidityRemoved(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity);

    /**
    * @notice Emitted when a token swap is executed.
    * @dev Logs the trader, token in/out, and the amounts exchanged.
    * @param trader The address that initiated the swap.
    * @param tokenIn The address of the token sent by the trader.
    * @param tokenOut The address of the token received by the trader.
    * @param amountIn Amount of tokenIn swapped.
    * @param amountOut Amount of tokenOut received.
    */
    event TokenSwapped(address indexed trader, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);




    /**
    * @notice Initializes the SimpleSwap contract with the name "Simple Swap" and symbol "SSWP".
    * @dev The constructor also sets the contract owner to the address that deploys the contract.
    *      The `ERC20` and `Ownable` constructors are called to set up the token name, symbol, and owner.
    */
    constructor()
        ERC20("Simple Swap", "SSWP")
        Ownable(msg.sender)
    {

    }

    /**
     * @notice Updates the internal reserves after liquidity is added.
     * @dev Increases the values stored in the `reserveOf` mapping for the specified tokens.
     *      This function should be called only after the tokens have been successfully transferred
     *      to the contract to ensure internal reserves remain in sync with actual balances.
     * @param tokenA The address of token A being added to the pool.
     * @param tokenB The address of token B being added to the pool.
     * @param amountA The amount of token A transferred to the contract.
     * @param amountB The amount of token B transferred to the contract.
     */
    function _updateReservesAfterAdd(address tokenA, address tokenB, uint256 amountA, uint256 amountB) 
            internal 
    {
        reserveOf[tokenA] += amountA;
        reserveOf[tokenB] += amountB;
    }

    /**
    * @notice Retrieves the current reserves of two tokens in the contract.
    * @dev This function queries the contract's balance for each token (tokenA and tokenB) 
    *      to determine how much liquidity is available for swapping or adding liquidity.
    * @param _tokenA Address of token A.
    * @param _tokenB Address of token B.
    * @return _reserveA The current balance (reserve) of token A in the contract.
    * @return _reserveB The current balance (reserve) of token B in the contract.
    */
    function _getReserves (address _tokenA, address _tokenB) 
            internal view returns (uint256 _reserveA, uint256 _reserveB) 
    {
        _reserveA = reserveOf[_tokenA]; //IERC20(_tokenA).balanceOf(address(this)); 
        _reserveB = reserveOf[_tokenB]; //IERC20(_tokenB).balanceOf(address(this));   

        return (_reserveA, _reserveB);
    }
    /**
    * @notice Safely transfers tokens from one address to another using the ERC20 `transferFrom` function.
    * @dev This function ensures that the transfer is successful by checking the result of the `transferFrom` call.
    *      If the transfer fails, it reverts the transaction with a specific error message.
    * @param _token Address of the token being transferred.
    * @param _from Address from which tokens will be transferred.
    * @param _to Address to which tokens will be transferred.
    * @param _amount The amount of tokens to transfer.
    */
    function _safeTransferFrom (address _token, address _from, address _to, uint256 _amount) 
            internal 
    {
        bool result = IERC20(_token).transferFrom(_from, _to, _amount);
        require(result, "SSwap: Transfer failed!");
    }
    /**
    * @notice Safely transfers tokens to a specified address using the ERC20 `transfer` function.
    * @dev This function ensures that the transfer is successful by checking the result of the `transfer` call.
    *      If the transfer fails, it reverts the transaction with a specific error message.
    * @param _token Address of the token being transferred.
    * @param _to Address to which tokens will be transferred.
    * @param _amount The amount of tokens to transfer.
    */
    function _safeTransfer (address _token, address _to, uint256 _amount) 
            internal 
    {
        bool result = IERC20(_token).transfer(_to, _amount);
        require(result, "SSwap: Transfer failed!");
    }

    /**
    * @notice Computes the integer square root of a given number using the Babylonian method.
    * @dev Returns the floor value of the square root (i.e., largest integer `z` such that `z*z <= y`).
    *      This method avoids overflow and handles small inputs explicitly.
    * @param y The unsigned integer input to compute the square root of.
    * @return z The integer square root of the input value.
    */
    function sqrt(uint y) 
            internal pure returns (uint z) 
    {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        } 
    }

    /**
    * @notice Calculates the minimum proportional value between token A and B based on their reserves.
    * @dev Prevents division by zero by replacing 0 reserves with 1. The function compares the ratios of value to reserve for both tokens 
    *      and returns the smallest ratio, which helps ensure price stability in the liquidity pool.
    * @param _tokenA Address of token A.
    * @param _tokenB Address of token B.
    * @param valueA Amount of token A provided.
    * @param valueB Amount of token B provided.
    * @return min The smaller of the two ratios: valueA/reserveA or valueB/reserveB.
    */
    function _calculateMin (address _tokenA, address _tokenB, uint256 valueA, uint256 valueB) 
            internal view returns(uint256 min) 
    {
        (uint256 _reserveA, uint256 _reserveB) = _getReserves(_tokenA, _tokenB); 
        _reserveA = _reserveA == 0 ? 1 : _reserveA;
        _reserveB = _reserveB == 0 ? 1 : _reserveB;
        min = (valueA / _reserveA < valueB / _reserveB) ? valueA / _reserveA : valueB / _reserveB;

        return min;
    }
    /**
    * @notice Calculates the amount of liquidity tokens to mint based on deposits and total supply.
    * @dev Uses a minimum ratio to maintain price equilibrium and proportional ownership.
    * @param tokenA Address of token A.
    * @param tokenB Address of token B.
    * @param amountA Amount of token A being added.
    * @param amountB Amount of token B being added.
    * @param totalSupply Current total supply of liquidity tokens.
    * @return _liquidity The number of liquidity tokens to mint.
    */
    function _calculateLiquidity (address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint256 totalSupply) 
            internal view returns (uint256 _liquidity) 
    {
        if (totalSupply == 0) {
            _liquidity = sqrt(amountA * amountB);
        } else {
            _liquidity = _calculateMin(tokenA, tokenB, amountA, amountB) * totalSupply;
        }
        return _liquidity;
    }

    /**
    * @notice Calculates the optimal output amount of token B for a given input of token A.
    * @dev Assumes a constant product formula without fee (i.e., simple x*y=k).
    * @param _amount The amount of input token (A).
    * @param _reserveA Reserve of input token (A).
    * @param _reserveB Reserve of output token (B).
    * @return amountOut The corresponding output amount of token B.
    */
    function _getOptimalAmountOut(uint256 _amount, uint256 _reserveA, uint256 _reserveB) 
            internal pure checkLiquidity(_reserveA, _reserveB) returns (uint256 amountOut) 
    {
        require(_amount > 0,"SSwap: Insufficient amount.");
        amountOut = (_amount * _reserveB) / _reserveA;
        return amountOut;
    }

    /**
    * @notice Calculates the optimal token amounts to add to the liquidity pool.
    * @dev Maintains price ratio based on current reserves. If the pool is empty, it accepts the desired amounts.
    * @param amountADesired The amount of token A the user wants to provide.
    * @param amountBDesired The amount of token B the user wants to provide.
    * @param amountAMin The minimum acceptable amount of token A to add.
    * @param amountBMin The minimum acceptable amount of token B to add.
    * @param _reserveA Current reserve of token A in the contract.
    * @param _reserveB Current reserve of token B in the contract.
    * @return amountA Final amount of token A to add.
    * @return amountB Final amount of token B to add.
    */
    function _addLiquidity(uint256 amountADesired,uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, uint256 _reserveA, uint256 _reserveB) 
            internal pure returns(uint256 amountA, uint256 amountB) 
    {
        uint256 optimalAmountA;
        uint256 optimalAmountB;

        if (_reserveA == 0 && _reserveB == 0) {
            (amountA, amountB) = (amountADesired , amountBDesired);
        } else {
            optimalAmountB = _getOptimalAmountOut(amountADesired ,_reserveA,_reserveB);
            if (optimalAmountB <= amountBDesired ) {
                require(optimalAmountB >= amountBMin, "SSwap: B Balance.");
                (amountA, amountB) = (amountADesired , optimalAmountB);
            } else {
                optimalAmountA = _getOptimalAmountOut(amountBDesired ,_reserveB,_reserveA);
                if (optimalAmountA <= amountADesired ) {
                    require(optimalAmountA >= amountAMin, "SSwap: A Balance.");  
                    (amountA, amountB) = (optimalAmountA, amountBDesired);
                } else {
                    revert("SSwap: amount constraints.");
                }
            }
        }
        return (amountA, amountB);
    }

    /**
    * @notice Adds liquidity to the pool by transferring token A and B to the contract.
    * @dev Mints liquidity tokens representing the user's share in the pool.
    * @param tokenA Address of token A.
    * @param tokenB Address of token B.
    * @param amountADesired Amount of token A the user wishes to add.
    * @param amountBDesired Amount of token B the user wishes to add.
    * @param amountAMin Minimum amount of token A the user is willing to add.
    * @param amountBMin Minimum amount of token B the user is willing to add.
    * @param to Address to receive the minted liquidity tokens.
    * @param deadline Unix timestamp after which the transaction is invalid.
    * @return amountA Final amount of token A deposited.
    * @return amountB Final amount of token B deposited.
    * @return liquidity Amount of liquidity tokens minted to the user.
    */
    function addLiquidity (address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, 
                           uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) 
            external checkDeadline(deadline) nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) 
    {
        require(tokenA != tokenB, "SSwap: Same Tokens");
        (uint256 _reserveA, uint256 _reserveB) = _getReserves(tokenA, tokenB);
        (amountA, amountB) = _addLiquidity(amountADesired, amountBDesired, amountAMin, amountBMin, _reserveA, _reserveB);

        _safeTransferFrom(tokenA, msg.sender, address(this), amountA);
        _safeTransferFrom(tokenB, msg.sender, address(this), amountB);

        _updateReservesAfterAdd(tokenA, tokenB, amountA, amountB);

        liquidity = _calculateLiquidity(tokenA, tokenB, amountA, amountB, totalSupply());
        _mint(to, liquidity);
        
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);

        return (amountA, amountB, liquidity);

    }   

    /**
    * @notice Calculates the amount of token A and B to return for a given liquidity.
    * @dev Assumes liquidity token represents proportional ownership of reserves.
    * @param _liquidity The amount of liquidity tokens being burned.
    * @param _reserveA Current reserve of token A in the pool.
    * @param _reserveB Current reserve of token B in the pool.
    * @return tokenAmountA Amount of token A to return.
    * @return tokenAmountB Amount of token B to return.
    */

    function _removeLiquidity(uint256 _liquidity, uint256 _reserveA, uint256 _reserveB) 
            internal view checkLiquidity(_reserveA, _reserveB) returns (uint256 tokenAmountA, uint256 tokenAmountB) 
    {
        uint256 _totalSupply = totalSupply();
        tokenAmountA = (_liquidity * _reserveA) / _totalSupply ;
        tokenAmountB = (_liquidity * _reserveB) / _totalSupply ;
        
        return (tokenAmountA, tokenAmountB);
    }

    /**
    * @notice Removes liquidity from the pool and returns token A and B to the user.
    * @param tokenA Address of token A.
    * @param tokenB Address of token B.
    * @param liquidity Amount of liquidity tokens to burn.
    * @param amountAMin Minimum acceptable amount of token A.
    * @param amountBMin Minimum acceptable amount of token B.
    * @param to Address to receive the withdrawn tokens.
    * @param deadline Unix timestamp after which the transaction is invalid.
    * @return amountA Amount of token A returned.
    * @return amountB Amount of token B returned.
    */
    function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline)
            external checkDeadline(deadline) nonReentrant returns (uint amountA, uint amountB) 
    {
        (uint256 _reserveA, uint256 _reserveB) = _getReserves(tokenA, tokenB);
        (amountA, amountB) = _removeLiquidity(liquidity, _reserveA, _reserveB);
        require(amountA>=amountAMin && amountB>=amountBMin,"SSwap: Balance.");
        reserveOf[tokenA] -= amountA;
        reserveOf[tokenB] -= amountB;
        burn(liquidity);
        _safeTransfer (tokenA,to,amountA);
        _safeTransfer (tokenB,to,amountB);

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);

        return (amountA, amountB);
    }

    /**
    * @notice Returns the expected output amount of token B for a given input of token A.
    * @dev Only supports two-token swaps (path.length == 2).
    * @param amountIn Input amount of token A.
    * @param path Array containing token A and token B addresses.
    * @return amounts Array where amounts[0] = input, amounts[1] = output.
    */
    function _getAmountsOut(uint256 amountIn, address[] memory path) 
            internal view checkTokensSelected(path) returns (uint256[] memory amounts) {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        (uint256 _reserveA, uint256 _reserveB) = _getReserves(path[0], path[1]);
        amounts[1] = _getOptimalAmountOut(amounts[0], _reserveA, _reserveB);
        
        return amounts;
    }

    /**
    * @notice Swaps an exact amount of token A for token B.
    * @param amountIn Exact amount of input tokens to send.
    * @param amountOutMin Minimum amount of output tokens expected.
    * @param path Array with two elements: [tokenIn, tokenOut].
    * @param to Recipient of the output tokens.
    * @param deadline Unix timestamp after which the transaction will revert.
    * @return amounts Array with input and output amounts: [amountIn, amountOut].
    */
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) 
            external checkDeadline(deadline) checkTokensSelected(path) nonReentrant returns (uint[] memory amounts) 
    {
        require(path[0] != path[1], "SSwap: Same tokens.");
        amounts = _getAmountsOut(amountIn, path);
        require(amounts[1] >= amountOutMin, "SSwap: Transfer cancelled.");
        _safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        _safeTransfer(path[1], to, amounts[1]);
        reserveOf[path[0]] += amounts[0]; 
        reserveOf[path[1]] -= amounts[1];
        
        emit TokenSwapped(msg.sender, path[0], path[1], amounts[0], amounts[1]);
        
        return amounts;
    }
    /**
     * @notice Synchronizes the internal reserve record for a given token with the actual on-chain balance.
     * @dev This function sets the `reserveOf` mapping to match the token's real balance held by the contract.
     *      It should be used if tokens are transferred directly to the contract outside of standard functions,
     *      potentially causing internal reserves to become inconsistent.
     * @param token The address of the ERC20 token to synchronize.
     */
    function syncReserve(address token) external onlyOwner {
        reserveOf[token] = IERC20(token).balanceOf(address(this));
    }

    /**
    * @notice Calculates output token amount based on input amount and reserves.
    * @dev Pure function, does not interact with state.
    * @param amountIn Amount of input tokens.
    * @param reserveIn Reserve of input token.
    * @param reserveOut Reserve of output token.
    * @return amountOut Expected amount of output tokens.
    */
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) 
            external pure returns (uint amountOut) 
    {
        amountOut = _getOptimalAmountOut(amountIn, reserveIn, reserveOut);

        return amountOut;
    }

    /**
    * @notice Returns the current price of tokenB in terms of tokenA.
    * @dev Uses 18 decimals for fixed-point precision.
    * @param tokenA Address of token A.
    * @param tokenB Address of token B.
    * @return price Price of tokenB per 1 tokenA (scaled by 1e18).
    */
    function getPrice(address tokenA, address tokenB) 
            external view returns (uint price) {
        (uint256 _reserveA, uint256 _reserveB) = _getReserves(tokenA, tokenB);
        require(_reserveA>0 && _reserveB>0,"SSwap: Liquidity.");
        price = (_reserveB * 1e18) / _reserveA;
        return price;
    }
}