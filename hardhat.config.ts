import { HardhatUserConfig } from "hardhat/types";
import "solidity-coverage";
import '@openzeppelin/hardhat-upgrades';
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-typechain";
import "hardhat-preprocessor";

import { mnemonic, apiKey } from "./secrets.json";
import { mnemonic as mnemonicProd, apiKey as apiKeyProd } from "./secrets.json";

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        compilers: [
            {
                version: "0.6.0",
                    settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                }
            },
            {
                version: "0.6.2",
                    settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                }
            },
            {
                version: "0.6.12",
                    settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                }
            },
            {
                version: "0.7.3",
                    settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                }
            },
            {
                version: "0.8.4",
                    settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                }
            },
        ],
        
    },
    networks: {
        hardhat: {
            gasPrice: 5000000000
        },
        localhost: {
            url: "http://127.0.0.1:8545",
        },
        coverage: {
            url: "http://127.0.0.1:8555",
        },
        testnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            gasPrice: 20000000000,
            accounts: {mnemonic: mnemonic}
        },
        mainnet: {
            url: "https://bsc-dataseed2.defibit.io/",
            chainId: 56,
            gasPrice: 7000000000,
            accounts: {mnemonic: mnemonicProd}
        },
    },
    etherscan: {
        apiKey: apiKey
    },
    paths: {
        sources: "./src",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
      },
};

export default config;
