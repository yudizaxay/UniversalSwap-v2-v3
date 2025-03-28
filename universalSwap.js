const Web3 = require('web3');
require('dotenv').config();

// Config with defaults that can be overridden by .env
const config = {
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB address
    token: process.env.TOKEN_ADDRESS || '', // From .env
    routerV2: '0x10ED43C718714eb63d5aA57B78B54704E256024E', //Router V2 address
    routerV3: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', //Router V3 address
    version: '', // Will be set by commandline
    amount: process.env.BNB_AMOUNT || '0.1', // Default BNB amount from .env
    operation: '', // Will be set by commandline
    percentage: parseInt(process.env.SELL_PERCENTAGE || '100'), // Default sell percentage from .env
    fee: 10000, // Default fee tier for V3 (1% = 10000)
    slippage: parseFloat(process.env.SLIPPAGE || '1'), // Default slippage from .env
    gasPrice: process.env.GAS_PRICE || '5', // Default gas price from .env
    gasLimit: parseInt(process.env.GAS_LIMIT || '500000') // Default gas limit from .env
};

// Setup web3
const web3 = new Web3(process.env.URL);

// ABIs
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

const ROUTER_V3_ABI = [
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

// Check if address is valid
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Get balances of BNB and token
async function getBalances(tokenAddress, wallet) {
    try {
        const token = new web3.eth.Contract(ERC20_ABI, tokenAddress);
        const wbnb = new web3.eth.Contract(WBNB_ABI, config.wbnb);

        const tokenBalance = await token.methods.balanceOf(wallet).call();
        const wbnbBalance = await wbnb.methods.balanceOf(wallet).call();
        const bnbBalance = await web3.eth.getBalance(wallet);

        let decimals = 18;
        let symbol = 'Unknown';

        try {
            decimals = await token.methods.decimals().call();
            symbol = await token.methods.symbol().call();
        } catch (error) {
            console.warn("Could not get token details, using defaults.");
        }

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

// Buy tokens using V2
async function buyTokensV2(tokenAddress, amount, wallet) {
    console.log("🚀 Starting UniversalSwap V2 Buy Operation");

    const routerV2 = new web3.eth.Contract(ROUTER_V2_ABI, config.routerV2);

    // Get initial balances
    const initialBalances = await getBalances(tokenAddress, wallet.address);
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Convert buy amount to Wei
    const buyAmountWei = web3.utils.toWei(amount, 'ether');

    // Check if we have enough BNB
    if (parseFloat(initialBalances.formatted.bnb) < parseFloat(amount) + 0.001) {
        console.error(`❌ Not enough BNB. You have ${initialBalances.formatted.bnb} BNB, but need at least ${parseFloat(amount) + 0.001} BNB.`);
        return false;
    }

    try {
        // Step 1: Estimate output amount (for slippage calculation)
        const path = [config.wbnb, tokenAddress];
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
            wallet.address,
            deadline
        ).send({
            from: wallet.address,
            value: buyAmountWei,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Buy transaction sent! TX Hash: ${buyTx.transactionHash}`);

        // Check final balances
        const finalBalances = await getBalances(tokenAddress, wallet.address);
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate tokens received
        const tokensReceived = parseFloat(finalBalances.formatted.token) - parseFloat(initialBalances.formatted.token);
        console.log(`🎉 Bought: ${tokensReceived.toFixed(6)} ${finalBalances.symbol}`);

        return true;
    } catch (error) {
        console.error(`❌ Buy failed: ${error.message}`);
        return false;
    }
}

// Sell tokens using V2
async function sellTokensV2(tokenAddress, percentage, wallet) {
    console.log("🚀 Starting UniversalSwap V2 Sell Operation");

    const routerV2 = new web3.eth.Contract(ROUTER_V2_ABI, config.routerV2);
    const token = new web3.eth.Contract(ERC20_ABI, tokenAddress);

    // Get initial balances
    const initialBalances = await getBalances(tokenAddress, wallet.address);
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Check if we have tokens to sell
    if (parseFloat(initialBalances.formatted.token) <= 0) {
        console.log("❌ No tokens to sell. Aborting.");
        return false;
    }

    // Calculate amount to sell based on percentage
    const tokenBalance = initialBalances.token;
    const sellAmount = BigInt(tokenBalance) * BigInt(percentage) / BigInt(100);

    if (sellAmount <= 0) {
        console.log("❌ Sell amount is zero. Aborting.");
        return false;
    }

    console.log(`📊 Selling ${percentage}% of ${initialBalances.symbol} tokens (${web3.utils.fromWei(sellAmount.toString(), 'ether')} tokens)`);

    try {
        // Step 1: Approve tokens for router
        console.log("🔓 Approving tokens for UniversalSwap V2 Router...");
        const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1

        const approveTx = await token.methods.approve(config.routerV2, maxApproval).send({
            from: wallet.address,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });

        console.log(`✅ Tokens approved for router. TX Hash: ${approveTx.transactionHash}`);

        // Step 2: Estimate output amount (for slippage calculation)
        const path = [tokenAddress, config.wbnb];
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
            wallet.address,
            deadline
        ).send({
            from: wallet.address,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Sell transaction sent! TX Hash: ${sellTx.transactionHash}`);

        // Check final balances
        const finalBalances = await getBalances(tokenAddress, wallet.address);
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate BNB received
        const bnbReceived = parseFloat(finalBalances.formatted.bnb) - parseFloat(initialBalances.formatted.bnb);
        console.log(`🎉 Received: ${bnbReceived.toFixed(6)} BNB from selling tokens`);

        return true;
    } catch (error) {
        console.error(`❌ Sell failed: ${error.message}`);
        return false;
    }
}

// Buy tokens using V3
async function buyTokensV3(tokenAddress, amount, wallet) {
    console.log("🚀 Starting UniversalSwap V3 Buy Operation");

    const routerV3 = new web3.eth.Contract(ROUTER_V3_ABI, config.routerV3);
    const wbnb = new web3.eth.Contract(WBNB_ABI, config.wbnb);

    // Get initial balances
    const initialBalances = await getBalances(tokenAddress, wallet.address);
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | WBNB: ${initialBalances.formatted.wbnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Convert buy amount to Wei
    const buyAmountWei = web3.utils.toWei(amount, 'ether');

    // Check if we have enough BNB
    if (parseFloat(initialBalances.formatted.bnb) < parseFloat(amount) + 0.001) {
        console.error(`❌ Not enough BNB. You have ${initialBalances.formatted.bnb} BNB, but need at least ${parseFloat(amount) + 0.001} BNB.`);
        return false;
    }

    try {
        // Step 1: Wrap BNB to WBNB
        console.log(`🔄 Wrapping ${amount} BNB to WBNB...`);
        const wrapTx = await wbnb.methods.deposit().send({
            from: wallet.address,
            value: buyAmountWei,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });
        console.log(`✅ BNB wrapped to WBNB. TX Hash: ${wrapTx.transactionHash}`);

        // Step 2: Approve WBNB for router
        console.log("🔓 Approving WBNB for UniversalSwap V3 Router...");
        const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1

        const approveTx = await wbnb.methods.approve(config.routerV3, maxApproval).send({
            from: wallet.address,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });

        console.log(`✅ WBNB approved for router. TX Hash: ${approveTx.transactionHash}`);

        // Step 3: Execute the swap using V3 Router
        console.log("📦 Sending V3 swap transaction...");

        // Calculate deadline - 30 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        // Create parameters object for exactInputSingle
        const params = {
            tokenIn: config.wbnb,
            tokenOut: tokenAddress,
            fee: config.fee,
            recipient: wallet.address,
            deadline: deadline,
            amountIn: buyAmountWei,
            amountOutMinimum: 0, // No minimum (be careful in production!)
            sqrtPriceLimitX96: 0 // No price limit
        };

        // Send the transaction
        const buyTx = await routerV3.methods.exactInputSingle(params).send({
            from: wallet.address,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Swap transaction sent! TX Hash: ${buyTx.transactionHash}`);

        // Check final balances
        const finalBalances = await getBalances(tokenAddress, wallet.address);
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | WBNB: ${finalBalances.formatted.wbnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate tokens received
        const tokensReceived = parseFloat(finalBalances.formatted.token) - parseFloat(initialBalances.formatted.token);
        console.log(`🎉 Bought: ${tokensReceived.toFixed(6)} ${finalBalances.symbol}`);

        return true;
    } catch (error) {
        console.error(`❌ Buy failed: ${error.message}`);
        return false;
    }
}

// Sell tokens using V3
async function sellTokensV3(tokenAddress, percentage, wallet) {
    console.log("🚀 Starting UniversalSwap V3 Sell Operation");

    const routerV3 = new web3.eth.Contract(ROUTER_V3_ABI, config.routerV3);
    const token = new web3.eth.Contract(ERC20_ABI, tokenAddress);

    // Get initial balances
    const initialBalances = await getBalances(tokenAddress, wallet.address);
    console.log(`💰 Initial balances: BNB: ${initialBalances.formatted.bnb} | WBNB: ${initialBalances.formatted.wbnb} | ${initialBalances.symbol}: ${initialBalances.formatted.token}`);

    // Check if we have tokens to sell
    if (parseFloat(initialBalances.formatted.token) <= 0) {
        console.log("❌ No tokens to sell. Aborting.");
        return false;
    }

    // Calculate amount to sell based on percentage
    const tokenBalance = initialBalances.token;
    const sellAmount = BigInt(tokenBalance) * BigInt(percentage) / BigInt(100);

    if (sellAmount <= 0) {
        console.log("❌ Sell amount is zero. Aborting.");
        return false;
    }

    console.log(`📊 Selling ${percentage}% of ${initialBalances.symbol} tokens (${initialBalances.formatted.token * percentage / 100} tokens)`);

    try {
        // Step 1: Approve tokens for router
        console.log("🔓 Approving tokens for UniversalSwap V3 Router...");
        const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // 2^256 - 1

        const approveTx = await token.methods.approve(config.routerV3, maxApproval).send({
            from: wallet.address,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: 100000
        });

        console.log(`✅ Tokens approved for router. TX Hash: ${approveTx.transactionHash}`);

        // Step 2: Execute the sell swap using V3 Router
        console.log("📦 Sending V3 sell transaction...");

        // Calculate deadline - 30 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        // Create parameters object for exactInputSingle (reversed from buy)
        const params = {
            tokenIn: tokenAddress,
            tokenOut: config.wbnb,
            fee: config.fee,
            recipient: wallet.address,
            deadline: deadline,
            amountIn: sellAmount.toString(),
            amountOutMinimum: 0, // No minimum (be careful in production!)
            sqrtPriceLimitX96: 0 // No price limit
        };

        // Send the transaction
        const sellTx = await routerV3.methods.exactInputSingle(params).send({
            from: wallet.address,
            gasPrice: web3.utils.toWei(config.gasPrice, 'gwei'),
            gas: parseInt(config.gasLimit)
        });

        console.log(`🚀 Sell transaction sent! TX Hash: ${sellTx.transactionHash}`);

        // Check final balances
        const finalBalances = await getBalances(tokenAddress, wallet.address);
        console.log(`💰 Final balances: BNB: ${finalBalances.formatted.bnb} | WBNB: ${finalBalances.formatted.wbnb} | ${finalBalances.symbol}: ${finalBalances.formatted.token}`);

        // Calculate WBNB received
        const wbnbReceived = parseFloat(finalBalances.formatted.wbnb) - parseFloat(initialBalances.formatted.wbnb);
        console.log(`🎉 Received: ${wbnbReceived.toFixed(6)} WBNB from selling tokens`);

        return true;
    } catch (error) {
        console.error(`❌ Sell failed: ${error.message}`);
        return false;
    }
}

// Main function that takes command line arguments instead of interactive input
async function executeSwap() {
    console.log("=== UniversalSwap Command Line Trading Bot ===");

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);

        if (args.length < 2) {
            console.log("Usage: node pancakeswapCLI.js <operation> <version> [amount/percentage]");
            console.log("Example for buy: node pancakeswapCLI.js buy v2 0.1");
            console.log("Example for sell: node pancakeswapCLI.js sell v2 50");
            console.log("\nNote: If amount/percentage is not provided, values from .env file will be used.");
            console.log(`Current default BNB amount: ${config.amount} BNB`);
            console.log(`Current default sell percentage: ${config.percentage}%`);
            return;
        }

        // Get operation
        const operation = args[0].toLowerCase();
        if (operation !== 'buy' && operation !== 'sell') {
            console.log("❌ Invalid operation. Please specify 'buy' or 'sell'.");
            return;
        }
        config.operation = operation;

        // Get version
        const version = args[1].toLowerCase();
        if (version !== 'v2' && version !== 'v3') {
            console.log("❌ Invalid version. Please specify 'v2' or 'v3'.");
            return;
        }
        config.version = version;

        // Get amount or percentage (optional - will use .env defaults if not provided)
        if (args.length >= 3) {
            if (operation === 'buy') {
                config.amount = args[2];
                console.log(`Using specified BNB amount: ${config.amount} BNB`);
            } else {
                const percentage = parseInt(args[2]);
                if (isNaN(percentage) || percentage < 1 || percentage > 100) {
                    console.log("❌ Invalid percentage. Please enter a number between 1 and 100.");
                    return;
                }
                config.percentage = percentage;
                console.log(`Using specified sell percentage: ${config.percentage}%`);
            }
        } else {
            // Using defaults from .env
            if (operation === 'buy') {
                console.log(`Using default BNB amount from .env: ${config.amount} BNB`);
            } else {
                console.log(`Using default sell percentage from .env: ${config.percentage}%`);
            }
        }

        // Check if we have a token address either from .env or need to prompt for it
        if (!config.token) {
            console.log("❌ No token address found in .env file (TOKEN_ADDRESS). Please add it to your .env file.");
            return;
        }

        // Validate token address
        if (!isValidAddress(config.token)) {
            console.log("❌ Invalid token address in .env file. Please enter a valid Ethereum address.");
            return;
        }

        // Setup wallet from private key
        if (!process.env.PRIVATE_KEY) {
            console.log("❌ No private key found in .env file. Please add your PRIVATE_KEY.");
            return;
        }
        const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
        web3.eth.accounts.wallet.add(account);
        console.log(`👛 Using wallet: ${account.address}`);

        // Check wallet balance first
        const bnbBalance = await web3.eth.getBalance(account.address);
        if (parseFloat(web3.utils.fromWei(bnbBalance, 'ether')) < 0.002) {
            console.log(`❌ Not enough BNB in wallet. You have ${web3.utils.fromWei(bnbBalance, 'ether')} BNB, but need at least 0.002 BNB for gas.`);
            return;
        }

        // Check token balances
        const tokenBalances = await getBalances(config.token, account.address);
        console.log(`\n💼 Current balances:`);
        console.log(`BNB: ${tokenBalances.formatted.bnb}`);
        console.log(`${tokenBalances.symbol}: ${tokenBalances.formatted.token}`);

        // Display summary
        console.log(`\n🔍 Summary:`);
        if (operation === 'buy') {
            console.log(`Operation: Buy ${tokenBalances.symbol} with ${config.amount} BNB using UniversalSwap ${config.version.toUpperCase()}`);

            // Execute buy based on version
            if (config.version === 'v2') {
                await buyTokensV2(config.token, config.amount, account);
            } else { // v3
                await buyTokensV3(config.token, config.amount, account);
            }
        } else { // sell
            if (parseFloat(tokenBalances.formatted.token) <= 0) {
                console.log(`❌ You don't have any ${tokenBalances.symbol} tokens to sell.`);
                return;
            }

            console.log(`Operation: Sell ${config.percentage}% of ${tokenBalances.symbol} (${parseFloat(tokenBalances.formatted.token) * config.percentage / 100} tokens) using UniversalSwap ${config.version.toUpperCase()}`);

            // Execute sell based on version
            if (config.version === 'v2') {
                await sellTokensV2(config.token, config.percentage, account);
            } else { // v3
                await sellTokensV3(config.token, config.percentage, account);
            }
        }

        // Display final balances
        console.log("\n📊 Transaction completed! Final balances:");
        const finalBalances = await getBalances(config.token, account.address);
        console.log(`BNB: ${finalBalances.formatted.bnb}`);
        console.log(`${finalBalances.symbol}: ${finalBalances.formatted.token}`);

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    }
}

// Run the executable swap
executeSwap().catch(error => {
    console.error(`❌ Uncaught error: ${error.message}`);
});