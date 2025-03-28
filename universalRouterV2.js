const Web3 = require('web3');
require('dotenv').config();

// === CONFIG ===
const config = {
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    token: '0x503Fa24B7972677F00C4618e5FBe237780C1df53', // Target token (change this to your V2 token)
    routerV2: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Router
    buyAmount: '0.0001', // BNB amount to swap when buying
    sellPercentage: 100, // Percentage of tokens to sell (100 = all)
    slippage: 1, // Slippage tolerance in percentage (1 = 1%)
    gasPrice: '5', // 5 gwei
    gasLimit: 500000 // 500k gas limit
};

// Setup web3 and account
const web3 = new Web3(process.env.URL);
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
const myAddress = account.address;

// Router V2 ABI
const ROUTER_V2_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "name": "swapExactETHForTokens",
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "name": "swapExactTokensForETH",
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" }
        ],
        "name": "getAmountsOut",
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// WBNB ABI
const WBNB_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    }
];

// ERC20 ABI
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
const routerV2 = new web3.eth.Contract(ROUTER_V2_ABI, config.routerV2);
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

// Buy tokens with BNB (V2)
async function buyTokensV2() {
    console.log("🚀 Starting PancakeSwap V2 Buy Operation");

    // Get initial balances
    const initialBalances = await getBalances();
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Convert buy amount to Wei
    const buyAmountWei = web3.utils.toWei(config.buyAmount, 'ether');

    // Check if we have enough BNB
    if (parseFloat(initialBalances.formatted.bnb) < parseFloat(config.buyAmount) + 0.001) {
        console.error(`❌ Not enough BNB. You have ${initialBalances.formatted.bnb} BNB, but need at least ${parseFloat(config.buyAmount) + 0.001} BNB.`);
        return false;
    }

    try {
        // Step 1: Estimate output amount (for slippage calculation)
        const path = [config.wbnb, config.token];
        const amountsOut = await routerV2.methods.getAmountsOut(buyAmountWei, path).call();
        const expectedOut = amountsOut[1];

        // Calculate minimum output with slippage
        const slippageFactor = 10000 - (config.slippage * 100);
        const minOut = BigInt(expectedOut) * BigInt(slippageFactor) / BigInt(10000);

        console.log(`💱 Expected output: ~${web3.utils.fromWei(expectedOut, 'ether')} ${initialBalances.symbol}`);
        console.log(`🛡️ Minimum output (${config.slippage}% slippage): ${web3.utils.fromWei(minOut.toString(), 'ether')} ${initialBalances.symbol}`);

        // Step 2: Execute swap (BNB -> Token)
        console.log("📦 Sending buy transaction...");

        // Calculate deadline - 30 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        // Execute swapExactETHForTokens
        const buyTx = await routerV2.methods.swapExactETHForTokens(
            minOut.toString(),
            path,
            myAddress,
            deadline
        ).send({
            from: myAddress,
            value: buyAmountWei,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Buy transaction sent! TX Hash: ${buyTx.transactionHash}`);

        // Check final balances
        const finalBalances = await getBalances();
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate tokens received
        const tokensReceived = parseFloat(finalBalances.formatted.token) - parseFloat(initialBalances.formatted.token);
        console.log(`🎉 Bought: ${tokensReceived.toFixed(6)} ${finalBalances.symbol}`);

        return true;
    } catch (error) {
        console.error(`❌ Buy failed: ${error.message}`);

        if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            console.log("💡 Slippage error: The swap would result in too few tokens. Try increasing slippage tolerance.");
        }

        throw error;
    }
}

// Sell tokens for BNB (V2)
async function sellTokensV2() {
    console.log("🚀 Starting PancakeSwap V2 Sell Operation");

    // Get initial balances
    const initialBalances = await getBalances();
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

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

    try {
        // Step 1: Approve tokens for router
        console.log("🔓 Approving tokens for PancakeSwap V2 Router...");
        const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1

        const approveTx = await token.methods.approve(config.routerV2, maxApproval).send({
            from: myAddress,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });

        console.log(`✅ Tokens approved for router. TX Hash: ${approveTx.transactionHash}`);

        // Step 2: Estimate output amount (for slippage calculation)
        const path = [config.token, config.wbnb];
        const amountsOut = await routerV2.methods.getAmountsOut(sellAmount.toString(), path).call();
        const expectedOut = amountsOut[1];

        // Calculate minimum output with slippage
        const slippageFactor = 10000 - (config.slippage * 100);
        const minOut = BigInt(expectedOut) * BigInt(slippageFactor) / BigInt(10000);

        console.log(`💱 Expected output: ~${web3.utils.fromWei(expectedOut, 'ether')} BNB`);
        console.log(`🛡️ Minimum output (${config.slippage}% slippage): ${web3.utils.fromWei(minOut.toString(), 'ether')} BNB`);

        // Step 3: Execute swap (Token -> BNB)
        console.log("📦 Sending sell transaction...");

        // Calculate deadline - 30 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        // Execute swapExactTokensForETH
        const sellTx = await routerV2.methods.swapExactTokensForETH(
            sellAmount.toString(),
            minOut.toString(),
            path,
            myAddress,
            deadline
        ).send({
            from: myAddress,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Sell transaction sent! TX Hash: ${sellTx.transactionHash}`);

        // Check final balances
        const finalBalances = await getBalances();
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate BNB received
        const bnbReceived = parseFloat(finalBalances.formatted.bnb) - parseFloat(initialBalances.formatted.bnb);
        console.log(`🎉 Received: ${bnbReceived.toFixed(6)} BNB from selling tokens`);

        return true;
    } catch (error) {
        console.error(`❌ Sell failed: ${error.message}`);

        if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            console.log("💡 Slippage error: The swap would result in too little BNB. Try increasing slippage tolerance.");
        }

        if (error.message.includes("TRANSFER_FROM_FAILED")) {
            console.log("💡 The token might have transfer restrictions or taxes that are preventing the sale.");
        }

        throw error;
    }
}

// Main function with operation selection
async function main() {
    const args = process.argv.slice(2);
    const operation = args[0] || "help"; // Default to help if no operation specified

    console.log("=== PancakeSwap V2 Trading Bot ===");
    console.log(`🔗 Network: BSC Mainnet`);
    console.log(`👛 Wallet: ${myAddress}`);
    console.log(`🎯 Token: ${config.token}`);
    console.log(`📍 Router V2: ${config.routerV2}`);
    console.log(`📊 Slippage: ${config.slippage}%`);

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
            await buyTokensV2();
        }
        else if (operation === "sell") {
            console.log(`\n📉 SELL OPERATION: Selling ${config.sellPercentage}% of tokens for BNB`);
            await sellTokensV2();
        }
        else if (operation === "balance" || operation === "balances") {
            const balances = await getBalances();
            console.log("\n💼 CURRENT BALANCES:");
            console.log(`BNB: ${balances.formatted.bnb}`);
            console.log(`${balances.symbol}: ${balances.formatted.token}`);
        }
        else {
            // Show help
            console.log("\n📚 AVAILABLE COMMANDS:");
            console.log("  node pancakeswap-v2-buy-sell.js buy    - Buy tokens with BNB");
            console.log("  node pancakeswap-v2-buy-sell.js sell   - Sell tokens for BNB");
            console.log("  node pancakeswap-v2-buy-sell.js balance - Show current balances");
            console.log("\nCONFIGURATION OPTIONS (edit in code):");
            console.log(`  Token: ${config.token}`);
            console.log(`  Buy amount: ${config.buyAmount} BNB`);
            console.log(`  Sell percentage: ${config.sellPercentage}%`);
            console.log(`  Slippage: ${config.slippage}%`);
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