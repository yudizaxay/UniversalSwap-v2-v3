const Web3 = require('web3');
require('dotenv').config();

// === CONFIG ===
const config = {
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    token: process.env.TOKEN, // Target token (WHY)
    swapRouterV3: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // SwapRouter V3
    buyAmount: '0.0001', // BNB amount to swap when buying
    sellPercentage: 100, // Percentage of tokens to sell (100 = all)
    fee: 10000, // 1% fee tier (10000)
    gasPrice: '5', // 5 gwei
    gasLimit: 500000 // 500k gas limit
};

// Setup web3 and account
const web3 = new Web3(process.env.URL);
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
const myAddress = account.address;

// Swap Router ABI - For both buy and sell functions
const SWAP_ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "tokenIn", "type": "address" },
                    { "internalType": "address", "name": "tokenOut", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "address", "name": "recipient", "type": "address" },
                    { "internalType": "uint256", "name": "deadline", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
                    { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
                ],
                "internalType": "struct ISwapRouter.ExactInputSingleParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "exactInputSingle",
        "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }],
        "stateMutability": "payable",
        "type": "function"
    }
];

// WBNB ABI
const WBNB_ABI = [
    {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{ "name": "", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{ "name": "guy", "type": "address" }, { "name": "wad", "type": "uint256" }],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
];

// ERC20 ABI - Added approve function for selling tokens
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
];

// Create contract instances
const swapRouter = new web3.eth.Contract(SWAP_ROUTER_ABI, config.swapRouterV3);
const wbnb = new web3.eth.Contract(WBNB_ABI, config.wbnb);
const token = new web3.eth.Contract(ERC20_ABI, config.token);

// Get balances of BNB, WBNB and target token
async function getBalances() {
    try {
        const wbnbBalance = await wbnb.methods.balanceOf(myAddress).call();
        const tokenBalance = await token.methods.balanceOf(myAddress).call();
        const bnbBalance = await web3.eth.getBalance(myAddress);
        const decimals = await token.methods.decimals().call();
        const symbol = await token.methods.symbol().call();

        return {
            wbnb: wbnbBalance,
            token: tokenBalance,
            bnb: bnbBalance,
            decimals,
            symbol,
            formatted: {
                wbnb: web3.utils.fromWei(wbnbBalance, 'ether'),
                token: (tokenBalance / (10 ** decimals)).toString(),
                bnb: web3.utils.fromWei(bnbBalance, 'ether')
            }
        };
    } catch (error) {
        console.warn("Error getting balances:", error.message);
        return {
            wbnb: '0',
            token: '0',
            bnb: '0',
            decimals: 18,
            symbol: 'TOKEN',
            formatted: {
                wbnb: '0',
                token: '0',
                bnb: '0'
            }
        };
    }
}

// Buy tokens: Swap BNB/WBNB for tokens
async function buyTokens() {
    console.log("🚀 Starting UniversalSwap V3 Buy Operation");

    // Get initial balances
    const initialBalances = await getBalances();
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | WBNB: ${initialBalances.formatted.wbnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Convert buy amount to Wei
    const buyAmountWei = web3.utils.toWei(config.buyAmount, 'ether');

    // Step 1: Check if we need to wrap BNB to WBNB
    const currentWBNBBalance = await wbnb.methods.balanceOf(myAddress).call();
    if (parseInt(currentWBNBBalance) < parseInt(buyAmountWei)) {
        console.log(`🔄 Wrapping ${config.buyAmount} BNB to WBNB...`);
        try {
            // First check if we have enough BNB
            const bnbBalance = await web3.eth.getBalance(myAddress);
            if (parseInt(bnbBalance) < parseInt(buyAmountWei) + 1000000000000000) { // Add some for gas
                throw new Error("Not enough BNB to wrap and pay for gas");
            }

            // Wrap BNB to WBNB
            const wrapTx = await wbnb.methods.deposit().send({
                from: myAddress,
                value: buyAmountWei,
                gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
                gas: 100000 // Lower gas for simple transaction
            });

            console.log(`✅ BNB wrapped to WBNB. TX Hash: ${wrapTx.transactionHash}`);
        } catch (error) {
            console.error(`❌ Failed to wrap BNB: ${error.message}`);
            throw error;
        }
    } else {
        console.log("✅ Already have enough WBNB for the swap");
    }

    // Step 2: Approve WBNB for router
    console.log("🔓 Approving WBNB for UniversalSwap V3 Router...");
    try {
        const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1

        const approveTx = await wbnb.methods.approve(config.swapRouterV3, maxApproval).send({
            from: myAddress,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });

        console.log(`✅ WBNB approved for router. TX Hash: ${approveTx.transactionHash}`);
    } catch (error) {
        console.error(`❌ Failed to approve WBNB: ${error.message}`);
        throw error;
    }

    // Step 3: Execute the buy swap (WBNB -> TOKEN)
    console.log("📦 Sending buy transaction...");
    try {
        // Calculate deadline - 30 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        // Create parameters object for exactInputSingle
        const params = {
            tokenIn: config.wbnb,
            tokenOut: config.token,
            fee: config.fee,
            recipient: myAddress,
            deadline: deadline,
            amountIn: buyAmountWei,
            amountOutMinimum: 0, // No minimum (be careful in production!)
            sqrtPriceLimitX96: 0 // No price limit
        };

        // Send the transaction
        const buyTx = await swapRouter.methods.exactInputSingle(params).send({
            from: myAddress,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Buy transaction sent! TX Hash: ${buyTx.transactionHash}`);
        console.log(`✅ Buy completed successfully`);

        // Check final balances
        const finalBalances = await getBalances();
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | WBNB: ${finalBalances.formatted.wbnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate tokens received
        const tokensReceived = parseFloat(finalBalances.formatted.token) - parseFloat(initialBalances.formatted.token);
        console.log(`🎉 Bought: ${tokensReceived.toFixed(6)} ${finalBalances.symbol}`);

        return true;
    } catch (error) {
        console.error(`❌ Buy failed: ${error.message}`);

        if (error.message.includes("execution reverted")) {
            console.log("💡 The transaction was reverted by the contract. Possible reasons:");
            console.log("- The token pair might not have enough liquidity");
            console.log("- Price impact could be too high");
            console.log("- The token might have transfer restrictions");
        }

        throw error;
    }
}

// Sell tokens: Swap tokens for BNB/WBNB
async function sellTokens() {
    console.log("🚀 Starting UniversalSwap V3 Sell Operation");

    // Get initial balances
    const initialBalances = await getBalances();
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | WBNB: ${initialBalances.formatted.wbnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Check if we have tokens to sell
    if (parseFloat(initialBalances.formatted.token) <= 0) {
        console.log("❌ No tokens to sell. Aborting.");
        return false;
    }

    // Calculate amount to sell based on percentage
    const tokenBalance = initialBalances.token;
    const sellAmount = BigInt(tokenBalance) * BigInt(config.sellPercentage) / BigInt(100);

    if (sellAmount <= 0) {
        console.log("❌ Sell amount is zero. Aborting.");
        return false;
    }

    console.log(`📊 Selling ${config.sellPercentage}% of ${initialBalances.symbol} tokens (${web3.utils.fromWei(sellAmount.toString(), 'ether')} tokens)`);

    // Step 1: Approve tokens for router
    console.log("🔓 Approving tokens for UniversalSwap V3 Router...");
    try {
        const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1

        const approveTx = await token.methods.approve(config.swapRouterV3, maxApproval).send({
            from: myAddress,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });

        console.log(`✅ Tokens approved for router. TX Hash: ${approveTx.transactionHash}`);
    } catch (error) {
        console.error(`❌ Failed to approve tokens: ${error.message}`);
        throw error;
    }

    // Step 2: Execute the sell swap (TOKEN -> WBNB)
    console.log("📦 Sending sell transaction...");
    try {
        // Calculate deadline - 30 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        // Create parameters object for exactInputSingle (reversed from buy)
        const params = {
            tokenIn: config.token,
            tokenOut: config.wbnb,
            fee: config.fee,
            recipient: myAddress,
            deadline: deadline,
            amountIn: sellAmount.toString(),
            amountOutMinimum: 0, // No minimum (be careful in production!)
            sqrtPriceLimitX96: 0 // No price limit
        };

        // Send the transaction
        const sellTx = await swapRouter.methods.exactInputSingle(params).send({
            from: myAddress,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Sell transaction sent! TX Hash: ${sellTx.transactionHash}`);
        console.log(`✅ Sell completed successfully`);

        // Check final balances
        const finalBalances = await getBalances();
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | WBNB: ${finalBalances.formatted.wbnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate WBNB received
        const wbnbReceived = parseFloat(finalBalances.formatted.wbnb) - parseFloat(initialBalances.formatted.wbnb);
        console.log(`🎉 Received: ${wbnbReceived.toFixed(6)} WBNB from selling tokens`);

        return true;
    } catch (error) {
        console.error(`❌ Sell failed: ${error.message}`);

        if (error.message.includes("execution reverted")) {
            console.log("💡 The transaction was reverted by the contract. Possible reasons:");
            console.log("- The token might have sell restrictions or taxes");
            console.log("- Insufficient allowance for the router");
            console.log("- The token pair might not have enough liquidity");
        }

        throw error;
    }
}

// Main function with operation selection
async function main() {
    const args = process.argv.slice(2);
    const operation = args[0] || "help"; // Default to help if no operation specified

    console.log("=== UniversalSwap V3 Trading Bot ===");
    console.log(`🔗 Network: BSC Mainnet`);
    console.log(`👛 Wallet: ${myAddress}`);
    console.log(`🎯 Token: ${config.token}`);
    console.log(`📍 SwapRouter V3: ${config.swapRouterV3}`);
    console.log(`📊 Fee tier: ${config.fee / 10000}% (${config.fee})`);

    try {
        // First check if we have enough BNB for gas
        const bnbBalance = await web3.eth.getBalance(myAddress);
        const minGasRequired = web3.utils.toWei('0.001', 'ether'); // At least 0.001 BNB for gas

        if (parseInt(bnbBalance) < parseInt(minGasRequired)) {
            console.error(`❌ Not enough BNB for gas. You have ${web3.utils.fromWei(bnbBalance, 'ether')} BNB, but need at least 0.001 BNB for gas.`);
            return;
        }

        // Execute the requested operation
        if (operation === "buy") {
            console.log(`\n📈 BUY OPERATION: Swapping ${config.buyAmount} BNB for tokens`);
            await buyTokens();
        }
        else if (operation === "sell") {
            console.log(`\n📉 SELL OPERATION: Selling ${config.sellPercentage}% of tokens for WBNB`);
            await sellTokens();
        }
        else if (operation === "balance" || operation === "balances") {
            const balances = await getBalances();
            console.log("\n💼 CURRENT BALANCES:");
            console.log(`BNB: ${balances.formatted.bnb}`);
            console.log(`WBNB: ${balances.formatted.wbnb}`);
            console.log(`${balances.symbol}: ${balances.formatted.token}`);
        }
        else {
            // Show help
            console.log("\n📚 AVAILABLE COMMANDS:");
            console.log("  node UniversalSwap-v3-buy-sell.js buy    - Buy tokens with BNB");
            console.log("  node UniversalSwap-v3-buy-sell.js sell   - Sell tokens for WBNB");
            console.log("  node UniversalSwap-v3-buy-sell.js balance - Show current balances");
            console.log("\nCONFIGURATION OPTIONS (edit in code):");
            console.log(`  Token: ${config.token}`);
            console.log(`  Buy amount: ${config.buyAmount} BNB`);
            console.log(`  Sell percentage: ${config.sellPercentage}%`);
            console.log(`  Fee tier: ${config.fee / 10000}%`);
            console.log(`  Gas price: ${config.gasPrice} gwei`);
            console.log(`  Gas limit: ${config.gasLimit}`);
        }
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    }
}

// Run main with proper error handling
main().catch(error => {
    console.error(`❌ Uncaught error: ${error.message}`);
});