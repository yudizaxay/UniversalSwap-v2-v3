# 🌟 Universal Swap Script

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful CLI and interactive Swap script for both Universal V2 and V3, enabling automated token swaps on BNB Chain.

![Universal Swap Script](https://images.ctfassets.net/oc3ca6rftwdu/4whjkXWytP10FiGWGcXUrO/99ae7bda00f8ccf71cd89d0c079de49d/banner.jpeg)

## ✨ Features

- 🔄 Support for both Universal V2 and V3
- 💰 Buy tokens with BNB or sell tokens for BNB
- 🛡️ Configurable slippage protection
- ⚙️ Gas price and limit configuration
- 💻 Two modes of operation:
  - Command-line interface for scripting and automation
  - Interactive interface for manual Swap
- 📊 Real-time balance tracking and transaction reporting
- 🔐 Secure local private key management
- 🧩 Modular design with separate V2 and V3 router implementations

## 📋 Prerequisites

- Node.js (v14 or later)
- npm or yarn
- BNB Chain wallet with:
  - Private key access
  - BNB for gas fees
  - Tokens (for selling operations)

## 🚀 Installation

1. Clone the repository:

```bash
git clone https://github.com/yudizaxay/UniversalSwap-v2-v3.git
cd UniversalSwap-v2-v3
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

4. Edit the `.env` file with your settings (see Configuration section)

## 📁 Project Structure

```
UNIVERSALSWAP-V2-V3/
├── .env.example         # Example environment variables
├── .gitignore           # Git ignore file
├── LICENSE              # MIT License
├── pancakeswapUniversal.js  # Main universal Swap script
├── README.md            # This file
├── universalRouterV2.js # Dedicated V2 router implementation
└── universalRouterV3.js # Dedicated V3 router implementation
```

## ⚙️ Configuration

Edit the `.env` file with your specific details:

```
# Connection and wallet
PRIVATE_KEY=your_private_key_here
URL=https://your-rpc-url/

# Token and Swap parameters
TOKEN_ADDRESS=your_token_address
BNB_AMOUNT=bnb_buy_amount
SELL_PERCENTAGE=100

# Transaction settings
SLIPPAGE=1
GAS_PRICE=3
GAS_LIMIT=500000
```

### Configuration Options:

| Parameter       | Description                              | Example                   |
| --------------- | ---------------------------------------- | ------------------------- |
| PRIVATE_KEY     | Your wallet's private key (keep secret!) | 0x123...                  |
| URL             | BSC RPC URL                              | https://your-rpc-url.com/ |
| TOKEN_ADDRESS   | Contract address of the token to trade   | 0x123...                  |
| BNB_AMOUNT      | Default BNB amount for buy operations    | 0.01                      |
| SELL_PERCENTAGE | Default percentage of tokens to sell     | 100                       |
| SLIPPAGE        | Maximum acceptable slippage percentage   | 1                         |
| GAS_PRICE       | Gas price in Gwei                        | 3                         |
| GAS_LIMIT       | Maximum gas units for transactions       | 500000                    |

## 📝 Usage

### Universal Swap Interface

The main script supports both V2 and V3 operations:

```bash
node pancakeswapUniversal.js <operation> <version> [amount/percentage]
```

Examples:

```bash
# Buy tokens using V2 (0.1 BNB)
node pancakeswapUniversal.js buy v2 0.1

# Buy tokens using V3 (default BNB amount from .env)
node pancakeswapUniversal.js buy v3

# Sell 50% of tokens using V2
node pancakeswapUniversal.js sell v2 50

# Sell all tokens using V3 (100%)
node pancakeswapUniversal.js sell v3
```

### Using Dedicated Router Files

You can also use the dedicated router files for V2 or V3 operations:

#### V2 Router:

```bash
node universalRouterV2.js <operation> [amount/percentage]
```

Examples:

```bash
# Buy tokens using V2
node universalRouterV2.js buy 0.1

# Sell tokens using V2
node universalRouterV2.js sell 50
```

#### V3 Router:

```bash
node universalRouterV3.js <operation> [amount/percentage]
```

Examples:

```bash
# Buy tokens using V3
node universalRouterV3.js buy 0.1

# Sell tokens using V3
node universalRouterV3.js sell 50
```

### Interactive Mode

For interactive Swap with step-by-step prompts:

```bash
node pancakeswapUniversal.js
```

## ⛽ Gas Fee Optimization

To optimize gas fees:

1. **Lower Gas Price**: Set a lower `GAS_PRICE` in your .env file (3-5 Gwei is usually sufficient on BSC)
2. **Check Network Conditions**: During network congestion, increase gas price slightly
3. **Batch Transactions**: Buy/sell larger amounts less frequently
4. **Monitor Gas**: Use [BSCScan Gas Tracker](https://bscscan.com/gastracker) to check current gas prices

**Note**: Always ensure you have enough BNB for gas fees (minimum recommended: 0.01 BNB)

## ⚠️ Security Warnings

- 🔒 **NEVER share your private key** or .env file with anyone
- 💻 Run this script only on secure systems
- 🧪 Test with small amounts first
- 🛡️ Set reasonable slippage values (1-3% recommended)
- 🔍 Always verify token addresses to avoid scams
- 🧾 Keep track of all transactions for tax purposes

## 📊 Example Transaction Flow

### Buy Operation:

1. Check wallet BNB balance
2. Estimate token output amount
3. Apply slippage protection
4. Execute swap transaction
5. Display final balances and tokens received

### Sell Operation:

1. Check wallet token balance
2. Approve tokens for router (one-time per token)
3. Estimate BNB output amount
4. Apply slippage protection
5. Execute swap transaction
6. Display final balances and BNB received

## ⚖️ Disclaimer

This software is provided "as is", without warranty of any kind. Use at your own risk. The authors are not responsible for any financial losses incurred while using this script.

Cryptocurrency Swap involves substantial risk. This tool is intended for educational and informational purposes only and should not be considered financial advice.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
