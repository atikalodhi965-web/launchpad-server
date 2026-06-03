// GraphQL subscription query
// const subscriptionQuery = `
// subscription WalletTradeMonitoring($walletAddress: String!) {
//   Solana {
//     DEXTradeByTokens(
//       where: {
//         Transaction: { Result: { Success: true } }
//         any: [
//           { Trade: { Account: { Address: { is: $walletAddress } } } }
//           { Trade: { Account: { Token: { Owner: { is: $walletAddress } } } } }
//         ]
//       }
//     ) {
//       Block { Time Slot }
//       Trade {
//         Currency { Name Symbol MintAddress Decimals Fungible Native }
//         Amount PriceInUSD Price
//         Side {
//           Type Amount AmountInUSD
//           Currency { Name Symbol MintAddress }
//         }
//         Account { Address Token { Owner } }
//         Dex { ProtocolName ProtocolFamily ProgramAddress }
//       }
//       Transaction { Signature Signer FeeInUSD }
//     }
//   }
// }`;
// Replace the old subscriptionQuery with this:
// const subscriptionQueryNew = `
// subscription MemeTokenTradeMonitoring($walletAddresses: [String!]!) {
//   dexTrades: Solana {
//     DEXTradeByTokens(
//       where: {
//         Transaction: {Result: {Success: true}}
//         Trade: {Currency: {
//             Fungible: true 
//             Symbol: { notIn: ["SOL", "WSOL", "USDC", "USDT"] }
//             }
//             }
//         any: [
//           {Trade: {Account: {Address: {in: $walletAddresses}}}}
//         ]
//       }
//     ) {
//       Block { Time Slot Height }
//       Trade {
//         Currency {
//           Name Symbol MintAddress Decimals Fungible Uri
//         }
//         Amount PriceInUSD Price AmountInUSD
//         Side {
//           Type Amount AmountInUSD
//           Currency { Name Symbol MintAddress Native }
//         }
//         Account { Address Token { Owner } }
//       }
//     }
//   }
//   pumpFunTrades: Solana {
//     DEXTradeByTokens(
//       where: {
//         Transaction: {Result: {Success: true}}
//         Trade: {Dex: {ProtocolName: {is: "pump"}} Currency: {Fungible: true}}
//         any: [
//           {Trade: {Account: {Address: {in: $walletAddresses}}}}
//         ]
//       }
//     ) {
//       Block { Time Slot Height }
//       Trade {
//         Currency {
//           Name Symbol MintAddress Decimals Fungible Uri MetadataAddress
//         }
//         Amount PriceInUSD Price AmountInUSD
//         Side {
//           Type Amount AmountInUSD
//           Currency { Name Symbol MintAddress }
//         }
//         Account { Address Token { Owner } }
//       }
//     }
//   }
//   letsBonkTrades: Solana {
//     DEXTradeByTokens(
//       where: {
//         Transaction: {Result: {Success: true}}
//         Trade: {Dex: {ProtocolName: {is: "raydium_launchpad"}} Currency: {Fungible: true}}
//         any: [
//           {Trade: {Account: {Address: {in: $walletAddresses}}}}
//         ]
//       }
//     ) {
//       Block { Time Slot Height }
//       Trade {
//         Currency {
//           Name Symbol MintAddress Decimals Fungible Uri MetadataAddress
//         }
//         Amount PriceInUSD Price AmountInUSD
//         Side {
//           Type Amount AmountInUSD
//           Currency { Name Symbol MintAddress }
//         }
//         Account { Address Token { Owner } }
//       }
//     }
//   }
// }
// `;
export const LatestSubscriptionQuery = `
subscription MemeTokenTradeMonitoring($walletAddresses: [String!]!) {
  dexTrades: Solana {
    DEXTradeByTokens(
      where: {Transaction: {Result: {Success: true}}, Trade: {Currency: {Fungible: true, Symbol: {notIn: ["SOL", "WSOL", "USDC", "USDT"]}}}, any: [{Trade: {Account: {Address: {in: $walletAddresses}}}}]}
    ) {
      Block {
        Time
      }
      Trade {
        Amount
        Price
        Side {
          Type
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Uri
          }
        }
        Account {
          Address
        }
      }
    }
  }
  pumpFunTrades: Solana {
    DEXTradeByTokens(
      where: {Transaction: {Result: {Success: true}}, Trade: {Currency: {Fungible: true, Symbol: {notIn: ["SOL", "WSOL", "USDC", "USDT"]}}}, any: [{Trade: {Account: {Address: {in: $walletAddresses}}}}]}
    ) {
      Block {
        Time
      }
      Trade {
        Amount
        Price
        Side {
          Type
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Uri
          }
        }
        Account {
          Address
        }
      }
    }
  }
  letsBonkTrades: Solana {
    DEXTradeByTokens(
      where: {Transaction: {Result: {Success: true}}, Trade: {Currency: {Fungible: true, Symbol: {notIn: ["SOL", "WSOL", "USDC", "USDT"]}}}, any: [{Trade: {Account: {Address: {in: $walletAddresses}}}}]}
    ) {
      Block {
        Time
      }
      Trade {
        Amount
        Price
        Side {
          Type
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Uri
          }
        }
        Account {
          Address
        }
      }
    }
  }
}
`;
// const previousDataQuery = `
// query FilteredTokenTradesAggregated($walletAddresses: [String!], $limit: Int = 50) {
//   Solana {
//     DEXTradeByTokens(
//       limit: {count: $limit}
//       orderBy: {descending: Block_Time}
//       where: {
//         Transaction: {Result: {Success: true}}
//         Trade: {
//           Currency: {
//             Fungible: true
//             MintAddress: {
//               notIn: [
//                 "So11111111111111111111111111111111111111112",  # WSOL
//                 "11111111111111111111111111111111111111111",   # SOL  
//                 "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
//                 "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", # USDT
//                 "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"  # USDC (Circle)
//               ]
//             }
//           }
//         }
//         any: [
//           {Trade: {Account: {Address: {in: $walletAddresses}}}},
//           {Trade: {Account: {Token: {Owner: {in: $walletAddresses}}}}},
//           {Transaction: {Signer: {in: $walletAddresses}}}
//         ]
//       }
//     ) {
//       Block {
//         Time
//         Slot
//       }
//       Transaction {
//         Signature
//         Signer
//         FeeInUSD
//       }
//       Trade {
//         Currency {
//           Name
//           Symbol
//           MintAddress
//           Decimals
//           Fungible
//           Native
//         }
//         Amount
//         Price
//         PriceInUSD
//         Side {
//           Type
//           Amount  
//           AmountInUSD
//           Currency {
//             Name
//             Symbol
//             MintAddress
//           }
//         }
//         Account {
//           Address
//           Token {
//             Owner
//           }
//         }
//         Dex {
//           ProtocolName
//           ProtocolFamily
//           ProgramAddress
//         }
//       }

//       # Trade Aggregations
//       buyVolume: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: buy}}}})
//       sellVolume: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: sell}}}})
//       totalVolume: sum(of: Trade_Side_AmountInUSD)
//       tradeCount: count
//     }
//   }
// }`;

export const queryOne = `
subscription MemeTokenTradeMonitoring($walletAddresses: [String!]!) {
  dexTrades: Solana {
    DEXTradeByTokens(
      where: {
        Transaction: {Result: {Success: true}},
        Trade: {
          Currency: {
            Fungible: true,
            MintAddress: {
              notIn: [
                "So11111111111111111111111111111111111111112", 
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 
                "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
              ]
            }
          },
          Amount: {gt: "0"}
        },
        any: [{Trade: {Account: {Address: {in: $walletAddresses}}}}]
      }
    ) {
      Block {
        Time
      }
      Trade {
        Amount
        Price
        Side {
          Type
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Uri
          }
        }
        Account {
          Address
        }
      }
    }
  }
}
`;

export const SIMPLE_PAST_TRADES_QUERY = `
query SimplePastTrades($walletAddresses: [String!]) {
  Solana {
    DEXTradeByTokens(
      limit: {count: 20}
      orderBy: {descending: Block_Time}
      where: {Transaction: {Result: {Success: true}}, Trade: {Currency: {Fungible: true, MintAddress: {notIn: ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"]}}, Amount: {gt: "0"}}, any: [{Trade: {Account: {Address: {in: $walletAddresses}}}}]}
    ) {
      Block {
        Time
      }
      Trade {
        Amount
        Price
        Side {
          Type
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Uri
          }
        }
        Account {
          Address
        }
      }
    }
  }
}
`;


// +++++++++++++++++ discovery tokens queries+++++++++++++++++++++
 
export const xSTOCK_TOKENS_QUERY = `
query XStockTokenizedAssets {
  Solana {
    DEXTradeByTokens(
      where: {
        any: [
          { Trade: { Currency: { Name: { includesCaseInsensitive: "xStock" } } } }
        ]
        Transaction: { Result: { Success: true } }
        Block: { Time: { since_relative: { days_ago: 7 } } }
      }
      limitBy: { by: [Trade_Currency_MintAddress], count: 1 }
      orderBy: { descending: Block_Time }
      limit: {count: 50}
    ) {
      Trade {
        Currency {
          MintAddress
          Name
          Symbol
          Uri
        }
      }
    }
  }
}
`;

export const VERIFIED_LSTS_QUERY = `
query VerifiedLSTsOnly {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: {
            MintAddress: {
              in: [
                "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
                "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
                "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
                "BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85",
                "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
                "kySo1nETpsZE2NWe5vj2C64mPSciH1SppmHb4XieQ7B",
                "CDCSoLckzozyktpAp9FWT3w92KFJVEUxAU7cNu2Jn3aX",
                "7cBuurYDdaqxnem7KyMTci6SWhjJKroZ6NUjqH2ewEPB",
                "GEJpt3Wjmr628FqXxTgxMce1pLntqPinPzks4eu9BC26",
                "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ",
                "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn",
                "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
                "Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B"
              ]
            }
          }
        }
        Transaction: { Result: { Success: true } }
        Block: { Time: { since_relative: { days_ago: 60 } } }
      }
      limitBy: { by: [Trade_Currency_MintAddress], count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Trade {
        Currency {
          MintAddress
          Name
          Symbol
          Uri
        }
      }
    }
  }
}
`;

export const TRENDING_TOKENS_QUERY = `
query TrendingByActivitySimple {
  Solana {
    # ========== 1 MINUTE ==========
    trending_1min: DEXTradeByTokens(
      limit: {count: 50}
      orderBy: {descendingByField: "tradesCountWithUniqueTraders"}
      where: {
        Block: {Time: {since_relative: {minutes_ago: 1}}}
        Trade: {Currency: {MintAddress: {notIn: ["So11111111111111111111111111111111111111112","11111111111111111111111111111111", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB","cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij","3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh","7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"]}}}
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {Currency {Name Symbol MintAddress Uri}}
      tradesCountWithUniqueTraders: count(distinct: Transaction_Signer)
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      trades: count
    }

    # ========== 5 MINUTES ==========
    trending_5min: DEXTradeByTokens(
      limit: {count: 50}
      orderBy: {descendingByField: "tradesCountWithUniqueTraders"}
      where: {
        Block: {Time: {since_relative: {minutes_ago: 5}}}
        Trade: {Currency: {MintAddress: {notIn: ["So11111111111111111111111111111111111111112","11111111111111111111111111111111", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB","cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij","3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh","7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"]}}}
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {Currency {Name Symbol MintAddress Uri}}
      tradesCountWithUniqueTraders: count(distinct: Transaction_Signer)
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      trades: count
    }

    # ========== 30 MINUTES ==========
    trending_30min: DEXTradeByTokens(
      limit: {count: 30}
      orderBy: {descendingByField: "tradesCountWithUniqueTraders"}
      where: {
        Block: {Time: {since_relative: {minutes_ago: 30}}}
        Trade: {Currency: {MintAddress: {notIn: ["So11111111111111111111111111111111111111112","11111111111111111111111111111111", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB","cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij","3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh","7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"]}}}
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {Currency {Name Symbol MintAddress Uri}}
      tradesCountWithUniqueTraders: count(distinct: Transaction_Signer)
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      trades: count
    }

    # ========== 1 HOUR ==========
    trending_1hour: DEXTradeByTokens(
      limit: {count: 20}
      orderBy: {descendingByField: "tradesCountWithUniqueTraders"}
      where: {
        Block: {Time: {since_relative: {hours_ago: 1}}}
        Trade: {Currency: {MintAddress: {notIn: ["So11111111111111111111111111111111111111112","11111111111111111111111111111111", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB","cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij","3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh","7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"]}}}
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {Currency {Name Symbol MintAddress Uri}}
      tradesCountWithUniqueTraders: count(distinct: Transaction_Signer)
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      trades: count
    }
  }
}
`;

export const POPULAR_TOKENS_QUERY = `
query PopularTokensByActivity {
  Solana {
    # ========== 24 HOURS ==========
    popular_24h: DEXTradeByTokens(
      limit: {count: 50}
      orderBy: {descendingByField: "tradesCountWithUniqueTraders"}
      where: {
        Block: {Time: {since_relative: {hours_ago: 24}}}
        Trade: {
          Currency: {
            MintAddress: {
              notIn: [
                "So11111111111111111111111111111111111111112", # Wrapped SOL
                "11111111111111111111111111111111",           # Native SOL
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", # USDT
                "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", # Excluded token
                "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", # Excluded token
                "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"  # ETH
              ]
            }
          }
        }
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade { Currency { Name Symbol MintAddress Uri} }
      tradesCountWithUniqueTraders: count(distinct: Transaction_Signer)
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      trades: count
    }

    # ========== 7 DAYS ==========
    popular_7d: DEXTradeByTokens(
      limit: {count: 50}
      orderBy: {descendingByField: "tradesCountWithUniqueTraders"}
      where: {
        Block: {Time: {since_relative: {days_ago: 7}}}
        Trade: {
          Currency: {
            MintAddress: {
              notIn: [
                "So11111111111111111111111111111111111111112",
                "11111111111111111111111111111111",
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
                "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
                "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"
              ]
            }
          }
        }
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade { Currency { Name Symbol MintAddress Uri} }
      tradesCountWithUniqueTraders: count(distinct: Transaction_Signer)
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      trades: count
    }
  }
}
`;

export const AI_TOKENS_QUERY = `
query AITokensOnSolana {
  Solana {
    DEXTradeByTokens(
      orderBy: {descending: Trade_Side_AmountInUSD}
      limit: {count: 50}
      where: {
        any: [
          # Core AI Keywords
          {Trade: {Currency: {Name: {includesCaseInsensitive: "AI"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "AI"}}}},
          {Trade: {Currency: {Uri: {includesCaseInsensitive: "AI"}}}},
          
          # Artificial Intelligence Variants
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Artificial Intelligence"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Artificial"}}}},
          
          # AGI
          {Trade: {Currency: {Name: {includesCaseInsensitive: "AGI"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "AGI"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "AGIX"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "AGIX"}}}},
          
          # Neural / ML
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Neuro"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "Neuro"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Neural"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Machine Learning"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Deep Learning"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "ML"}}}},
          
          # Bots
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Bot"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "Bot"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Chatbot"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Assistant"}}}},
          
          # Singularity
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Singularity"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "SingularityNET"}}}},
          
          # Infra
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Compute"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "GPU"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Data"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Oracle"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Prediction"}}}},
          
          # Known AI Tokens
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Ocean"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "OCEAN"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Fetch"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "FET"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Render"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "RNDR"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "Akash"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "AKT"}}}},
          {Trade: {Currency: {Name: {includesCaseInsensitive: "ai16z"}}}},
          {Trade: {Currency: {Symbol: {includesCaseInsensitive: "AI16Z"}}}}
        ],
        # Exclude common tokens
        Trade: {
          Currency: {
            MintAddress: {
              notIn: [
                "So11111111111111111111111111111111111111112", # wSOL
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
              ]
            }
          }
        },
        Transaction: {Result: {Success: true}},
        Block: {Time: {since_relative: {days_ago: 30}}}
      }
    ) {
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
          Uri
        }
    }
    }
  }
}
`;

export const BLUECHIP_MEMES_QUERY = `
query BlueChipMemes {
  Solana {
    TokenSupplyUpdates(
      where: {
        TokenSupplyUpdate: {
          PostBalanceInUSD: { ge: "50000000" } # threshold: 50M USD
        	Currency: {
      			Symbol: { notIn: ["USDC", "USDT", "DAI"] }
    			}
        }
      }
      orderBy: {descending: TokenSupplyUpdate_PostBalanceInUSD}
      limitBy: { by: TokenSupplyUpdate_Currency_MintAddress, count: 1 } # UNIQUE TOKENS
      limit: {count: 50}
    ) {
      TokenSupplyUpdate {
        Marketcap: PostBalanceInUSD
        Currency {
          Name
          Symbol
          MintAddress
          Uri
        }
      }
    }
  }
}
`;

// +++++++++++++++launchpads tokens query++++++++++++++++++

export const NEWLY_CREATED_TOKENS_SUB = /* GraphQL */ `
subscription NewlyCreatedTokensRealTime {
  Solana {
    Instructions(
      where: {
        Instruction: {
          Program: { Address: { is: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" }, Method: { is: "CreateMetadataAccountV3" } }
        }
        Transaction: { Result: { Success: true } }
      }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time Slot }
      Instruction {
        Accounts {
          Address
          Token { Mint Owner }
        }
        Program {
          Address
          Name
          Method
          Arguments {
            Name
            Type
            Value {
              ... on Solana_ABI_Json_Value_Arg { json }
              ... on Solana_ABI_String_Value_Arg { string }
              ... on Solana_ABI_Address_Value_Arg { address }
              ... on Solana_ABI_Boolean_Value_Arg { bool }
              ... on Solana_ABI_Integer_Value_Arg { integer }
              ... on Solana_ABI_Float_Value_Arg { float }
              ... on Solana_ABI_Bytes_Value_Arg { hex }
              ... on Solana_ABI_BigInt_Value_Arg { bigInteger }
            }
          }
          AccountNames
        }
      }
      Transaction { Fee FeeInUSD FeePayer Index }
    }
  }
}
`;
export const NEWLY_CREATED_TOKENS_QUERY = `
query NewlyCreatedTokensLast10Minutes {
  Solana {
    Instructions(
      where: {
        Block: { Time: { since_relative: { minutes_ago: 10 } } }
        Instruction: {
          Program: { 
            Address: { is: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" }, 
            Method: { is: "CreateMetadataAccountV3" } 
          }
        }
        Transaction: { Result: { Success: true } }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 25 }
    ) {
      Block { 
        Time 
        Slot 
      }
      Instruction {
        Accounts {
          Address
          Token { 
            Mint 
            Owner 
            ProgramId 
          }
        }
        Program {
          Arguments {
            Name
            Value {
              ... on Solana_ABI_Json_Value_Arg { json }
            }
          }
        }
      }
      Transaction { 
        Fee 
        FeeInUSD 
        FeePayer 
      }
    }
  }
}`;

export const ALMOST_BONDED_QUERY = `
query GetTokensByBondingCurveAndAge {
  Solana {
    DEXPools(
      where: {Pool: {Base: {PostAmount: {ge: "230693000", le: "801725000"}}, 
        Dex: {ProgramAddress: {
          in: [
            "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", 
            "MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG", 
            "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
            "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
            ]}}, 
        Market: {QuoteCurrency: {
          MintAddress: {
            in: [
              "11111111111111111111111111111111", 
              "So11111111111111111111111111111111111111112"
            ]}}}}, 
        Transaction: {
          Result: {Success: true}}, Block: {Time: {since_relative: {hours_ago: 10}}}}
          limitBy: {by: Pool_Market_BaseCurrency_MintAddress, count: 1}
          orderBy: {descending: Block_Time}
          limit: {count: 25}
    ) {
      Bonding_Curve_Progress_Percentage: calculate(
        expression: "100 - ((($Pool_Base_Balance - 206900000) * 100) / 793100000)"
      )
      Pool {
        Market {
          BaseCurrency {
            MintAddress
            Name
            Symbol
            Decimals
            Uri
          }
          MarketAddress
        }
        Dex {
          ProtocolName
          ProtocolFamily
          ProgramAddress
        }
        Base {
          Balance: PostAmount
        }
        Quote {
          PostAmount
          PriceInUSD
          PostAmountInUSD
        }
      }
      Block {
        Time
        Slot
        Hash
      }
    }
  }
}
`;
export const GET_SUB_ALMOST_BONDED = `
subscription GetTokensByBondingCurveRealtime {
  Solana {
    DEXPools(
      where: {
        Pool: {
          Base: {PostAmount: {ge: "230693000", le: "286210000"}}
          Dex: {
            ProgramAddress: {
              in: [
                "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", 
                "MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG", 
                "FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1", 
                "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
                "virEFLZsQm1iFAs8py1XnziJ67gTzW2bfCWhxNPfccD"
              ]
            }
          }
          Market: {
            QuoteCurrency: {
              MintAddress: {
                in: [
                  "11111111111111111111111111111111", 
                  "So11111111111111111111111111111111111111112"
                ]
              }
            }
          }
        }
        Transaction: {Result: {Success: true}}
      }
    ) {
      Bonding_Curve_Progress_Percentage: calculate(
        expression: "100 - ((($Pool_Base_Balance - 206900000) * 100) / 793100000)"
      )
      Pool {
        Market {
          BaseCurrency {
            MintAddress
            Name
            Symbol
            Decimals
            Uri
          }
          MarketAddress
        }
        Dex {
          ProtocolName
          ProtocolFamily
          ProgramAddress
        }
        Base {
          Balance: PostAmount
        }
        Quote {
          PostAmount
          PriceInUSD
          PostAmountInUSD
        }
      }
      Block {
        Time
        Slot
        Hash
      }
    }
  }
}`;
export const GET_MIGRATED_TOKENS_QUERY = `
query GetMigratedTokensLast10Hours {
  Solana {
    Instructions(
      where: {
        Block: { Time: { since_relative: { hours_ago: 10 } } }
        Transaction: { Result: { Success: true } }
        Instruction: {
          Program: {
            Address: {
              in: [
                "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", 
                "MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG", 
                "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
                "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
              ]
            }
            Method: {
              in: ["withdraw", "migrate_meteora_damm", "migration_damm_v2", "graduate", "complete", "finalize"]
            }
          }
        }
      }
      limit: { count: 25 }
      orderBy: { descending: Block_Time }
    ) {
      Block {
        Time
        Slot
        Hash
      }
      Transaction {
        Signature
        Signer
        Fee
        FeeInUSD
      }
      Instruction {
        Accounts {
          Address
          Token {
            Mint
            Owner
            ProgramId
          }
        }
        Program {
          Address
          Name
          Method
        }
      }
    }
  }
}
`;

export const GET_SUB_MIGRATED_TOKENS = `
subscription GetMigratedTokensRealtime {
  Solana {
    Instructions(
      where: {
        Transaction: { Result: { Success: true } }
        Instruction: {
          Program: {
            Address: {
              in: [
                "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
                "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
                "boop8hVGQGqehUK2iVEMEnMrL5RbjywRzHKBmBE7ry4",
                "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"
              ]
            }
            Method: {
              in: ["withdraw", "migrate_meteora_damm", "migration_damm_v2", "graduate", "complete", "finalize"]
            }
          }
        }
      }
    ) {
      Block {
        Time
        Slot
        Hash
      }
      Transaction {
        Signature
        Signer
        Fee
        FeeInUSD
      }
      Instruction {
        Accounts {
          Address
          Token {
            Mint
            Owner
            ProgramId
          }
        }
        Program {
          Address
          Name
          Method
        }
      }
    }
  }
}`;


// ++++++++++++++++++ token analytics queries++++++++++++++++++++++++
 const SINGLE_CREATION_TIME_OF_TOKEN = `
 {
 Solana(dataset: combined) {
  DEXTradeByTokens(
   where: {Trade: {Currency: {MintAddress: {is: "EVJ5xPVNXdjfVKtPYP2V99vCAPDpUVAopSeTcZJ9pump"}}}}
  ) {
   Block {
    Time(minimum: Block_Time)
   }
  }
 }
}`;

export const BATCH_CREATION_TIME_OF_TOKEN = `
query GetTokenCreationTimes($mintAddresses: [String!]) {
  Solana(dataset: combined) {
    DEXTradeByTokens(
      limitBy: { by: Trade_Currency_MintAddress, count: 1 }
      where: {Trade: {Currency: {MintAddress: {in: $mintAddresses}}}}
    ) {
      Trade {
        Currency {
          MintAddress
          Name
          Symbol
        }
      }
      Block {
        Time(minimum: Block_Time)
      }
    }
  }
}`;

const SINGLE_GET_TOTAL_SUPPLY_OF_TOKEN = `
{
  Solana {
    TokenSupplyUpdates(
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
      where: {
        TokenSupplyUpdate: {
          Currency: { MintAddress: { is: "CivEAsPbbUdbvj1oh7iVKVwJjsa6gSKi3icokPnWpump" } }
        }
      }
    ) {
      TokenSupplyUpdate {
        Amount
        Currency {
          MintAddress
          Name
        }
        PreBalance
        PostBalance
      }
    }
  }
}`;

export const BATCH_GET_TOTAL_SUPPLY_OF_TOKEN = `
query GetTokenSupplies($mintAddresses: [String!]) {
  Solana {
    TokenSupplyUpdates(
      limitBy: { by: TokenSupplyUpdate_Currency_MintAddress, count: 1 }
      orderBy: { descending: Block_Time }
      where: {
        TokenSupplyUpdate: {
          Currency: { MintAddress: { in: $mintAddresses } }
        }
      }
    ) {
      TokenSupplyUpdate {
        Amount
        Currency {
          MintAddress
          Name
        }
        PreBalance
        PostBalance
      }
    }
  }
}`;


// ===================================

const GET_TOKEN_PRICE_AT_SPECIFIC_TIME =  `
query GetTokenPricesAtSpecificTime($mintAddresses: [String!], $specificTime: DateTime) {
  Solana {
    # --- Price at Specific Time ---
    PriceMetrics: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { in: $mintAddresses } }
        }
        Block: {
          Time: { till: $specificTime }
        }
      }
      limitBy: { by: [Trade_Currency_MintAddress], count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Block {
        Time
      }
      Trade {
        Currency {
          MintAddress
          Symbol
          Name
        }
        PriceInUSD
        Price
        Side {
          Currency {
            Symbol
            MintAddress
          }
        }
      }
    }
  }
}`;

const GET_SUPPLY_OF_TOKEN_AT_SPECIFIC_TIME = `
query GetTokenSupplyAtTradeTime($tokenMintAddress: String, $tradeTime: DateTime) {
  Solana(dataset: realtime) {
    TokenSupplyUpdates(
      where: {
        TokenSupplyUpdate: {
          Currency: {
            MintAddress: { is: $tokenMintAddress }
          }
        }
        Block: {
          Time: { till: $tradeTime }
        }
        Transaction: { Result: { Success: true } }
      }
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Block {
        Time
        Slot
      }
      TokenSupplyUpdate {
        Currency {
          Name
          Symbol
          MintAddress
          Decimals
        }
        PostBalance
        PostBalanceInUSD
        PreBalance
        Amount
      }
    }
  }
}`;




// ------------------------------------------

export const GET_TOP_HOLDERS_QUERY = `
query GetTopTokenHolders($mintAddresses: [String!]!) {
  Solana(dataset: realtime) {
    BalanceUpdates(
      limitBy: {by: BalanceUpdate_Currency_MintAddress, count: 10}
      orderBy: {descendingByField: "BalanceUpdate_Holding_maximum"}
      where: {
        BalanceUpdate: {Currency: {MintAddress: {in: $mintAddresses}}}, 
        Transaction: {Result: {Success: true}}
      }
    ) {
      BalanceUpdate {
        Currency {
          MintAddress
        }
        Account {
          Address
          Token {
            Owner
          }
        }
        Holding: PostBalance(maximum: Block_Slot, selectWhere: {gt: "0"})
      }
    }
  }
}`;

export const GET_TOKEN_OHLC_QUERY =`
query ($mintAddress: String!, $solMint: String!, $limit: Int!, $intervalInMinutes: Int!) {
    Solana {
      DEXTradeByTokens(
        orderBy: {descendingByField: "Block_Timefield"}
        where: {
          Trade: {
            Currency: {MintAddress: {is: $mintAddress}},
            Side: {Currency: {MintAddress: {is: $solMint}}}
          },
          Block: {Time: {since_relative: {hours_ago: 24}}}
        }
        limit: {count: $limit}
      ) {
        Block {
          Timefield: Time(interval: {in: minutes, count: $intervalInMinutes})
        }
        volume: sum(of: Trade_Amount)
        Trade {
          high: Price(maximum: Trade_Price)
          low: Price(minimum: Trade_Price)
          open: Price(minimum: Block_Slot)
          close: Price(maximum: Block_Slot)
        }
        count
      }
    }
  }
`;
export const GET_MULTI_TOKENCHART_OHLAC_DATA= `
query GetMultiTokenOHLCData($mintAddresses: [String!]!, $solMint: String!, $limit: Int!, $intervalInMinutes: Int!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: {MintAddress: {in: $mintAddresses}},
          Side: {Currency: {MintAddress: {is: $solMint}}}
        },
        Block: {Time: {since_relative: {hours_ago: 24}}}
        Transaction: {Result: {Success: true}}
      }
      orderBy: {descendingByField: "Block_Timefield"}
      limit: {count: $limit}
    ) {
      Block {
        Timefield: Time(interval: {in: minutes, count: $intervalInMinutes})
      }
      Trade {
        Currency {
          MintAddress
          Symbol
          Name
        }
        high: Price(maximum: Trade_Price)
        low: Price(minimum: Trade_Price)
        open: Price(minimum: Block_Slot)
        close: Price(maximum: Block_Slot)
      }
      volume: sum(of: Trade_Amount)
      count
    }
  }
}`;
const token_ohlc_data_for_multiple_tokens = `
query GetTokenChartData($mintAddress: String!, $solMint: String!, $limit: Int!, $intervalInMinutes: Int!) {
  Solana {
    DEXTradeByTokens(
      orderBy: {descendingByField: "Block_Timefield"}
      where: {
        Trade: {
          Currency: {MintAddress: {is: $mintAddress}},
          Side: {Currency: {MintAddress: {is: $solMint}}}
        },
        Block: {Time: {since_relative: {hours_ago: 24}}}
      }
      limit: {count: $limit}
    ) {
      Block {
        Timefield: Time(interval: {in: minutes, count: $intervalInMinutes})
      }
      Trade {
        Currency {
          MintAddress
          Symbol
          Name
        }
        high: Price(maximum: Trade_Price)
        low: Price(minimum: Trade_Price)
        open: Price(minimum: Block_Slot)
        close: Price(maximum: Block_Slot)
      }
      volume: sum(of: Trade_Amount)
      count
    }
  }
}`;

const get_token_supply_and_price_at_specific_time = `
query GetTokenSupplyAndPriceAtSpecificTime($tokenMintAddress: String!, $specificTime: DateTime!) {
  Solana(dataset: realtime) {
    # --- Token Supply at Specific Time ---
    TokenSupplyData: TokenSupplyUpdates(
      where: {
        TokenSupplyUpdate: {
          Currency: {
            MintAddress: { is: $tokenMintAddress }
          }
        }
        Block: {
          Time: { till: $specificTime }
        }
        Transaction: { Result: { Success: true } }
      }
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Block {
        Time
        Slot
      }
      TokenSupplyUpdate {
        Currency {
          Name
          Symbol
          MintAddress
          Decimals
        }
        PostBalance
        PostBalanceInUSD
        PreBalance
        Amount
      }
    }
    
    # --- Token Price at Specific Time ---
    PriceData: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { is: $tokenMintAddress } }
        }
        Block: {
          Time: { till: $specificTime }
        }
      }
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Block {
        Time
      }
      Trade {
        Currency {
          MintAddress
          Symbol
          Name
        }
        PriceInUSD
        Price
        Side {
          Currency {
            Symbol
            MintAddress
          }
        }
      }
    }
  }
}`;

export const GET_LATEST_TRADES_QUERY = `
query GetLatestTokenTrades($mintAddress: String!, $solMint: String = "So11111111111111111111111111111111111111112") {
  Solana {
    DEXTrades(
      where: {
        any: [
          {Trade: {Buy: {Currency: {MintAddress: {is: $mintAddress}}}, Sell: {Currency: {MintAddress: {is: $solMint}}}}}, 
          {Trade: {Sell: {Currency: {MintAddress: {is: $mintAddress}}}, Buy: {Currency: {MintAddress: {is: $solMint}}}}}
        ], 
        Transaction: {Result: {Success: true}}
      }
      orderBy: {descending: Block_Time}
      limit: {count: 10}
    ) {
      Block {
        Time
      }
      Transaction {
        Signer
        Signature
      }
      Trade {
        Buy {
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Decimals
          }
          AmountInUSD
        }
        Sell {
          Amount
          Currency {
            Name
            Symbol
            MintAddress
            Decimals
          }
          AmountInUSD
        }
      }
    }
  }
}`;
 export const GET_CURRENT_PRICE_OFTOKE_IN_BATCH= `
 query GetCurrentTokenPrices($mintAddresses: [String!]!) {
  Solana(dataset: realtime) {
    PriceMetrics: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { in: $mintAddresses } }
        }
      }
      limitBy: { by: Trade_Currency_MintAddress, count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Trade {
        Currency {
          MintAddress
        }
        PriceInUSD
        Price
      }
    }
  }
}`
// ---------------------------

// ______________________check trades last 24 hours-------------------

const SINGLE_CHECK_TRADES_LAST_HOURS =`
query CheckTradesLast24Hours($mintAddress: String!, $hours_ago: Int ) {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {is: $mintAddress}}}, Block: {Time: {since_relative: {hours_ago: $hours_ago}}}, Transaction: {Result: {Success: true}}}
      limit: {count: 1}
    ) {
      trades_count: count
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
        PriceInUSD
        Amount
      }
      Block {
        Time
      }
    }
  }
}
`;
export const MULTIPLE_CHECK_LAST_HOURS =`
query CheckTradesLast24HoursMultiple($mintAddresses: [String!]!, $hours_ago: Int) {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {in: $mintAddresses}}}, Block: {Time: {since_relative: {hours_ago: $hours_ago}}}, Transaction: {Result: {Success: true}}}
      limitBy: {by: Trade_Currency_MintAddress, count: 1}
      orderBy: {descending: Block_Time}
    ) {
      trades_count: count
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
        PriceInUSD
        Amount
      }
      Block {
        Time
      }
    }
  }
}
`;
const SINGLE_CHECK_TRADES_LAST_DAYS = `
query CheckTradesLast7Days($mintAddress: String!) {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {is: $mintAddress}}}, Block: {Time: {since_relative: {days_ago: 7}}}, Transaction: {Result: {Success: true}}}
      limit: {count: 1}
    ) {
      trades_count: count
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
        PriceInUSD
        Amount
      }
      Block {
        Time
      }
    }
  }
}
`;
export const MULTIPLE_CHECKTRADES_LAST_7DAYS = `
query CheckTradesLast7DaysMultiple($mintAddresses: [String!]!) {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {in: $mintAddresses}}}, Block: {Time: {since_relative: {days_ago: 7}}}, Transaction: {Result: {Success: true}}}
      limitBy: {by: Trade_Currency_MintAddress, count: 1}
      orderBy: {descending: Block_Time}
    ) {
      trades_count: count
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
        PriceInUSD
        Amount
      }
      Block {
        Time
      }
    }
  }
}
`;

export const GET_TOKEN_ANALYTICS_QUERY = /* GraphQL */ `
query GetTokenAnalyticsSummary($tokenMint: String!) {
  Solana {
    # 1. HOLDER COUNT
    holder_count: BalanceUpdates(
      where: {
        BalanceUpdate: {
          Currency: { MintAddress: { is: $tokenMint } }
          PostBalance: { gt: "0" }
        }
      }
    ) {
      total_holders: uniq(of: BalanceUpdate_Account_Owner)
    }

    # 2. ALL-TIME TRADING STATS
    all_time_trading_stats: DEXTradeByTokens(
      where: {
        Trade: { Currency: { MintAddress: { is: $tokenMint } } }
        Transaction: { Result: { Success: true } }
      }
    ) {
      total_buys: count(if: { Trade: { Side: { Type: { is: buy } } } })
      total_sells: count(if: { Trade: { Side: { Type: { is: sell } } } })
      total_trades: count
    }

    # 3. CURRENT TRADING STATS (24H)
    current_trading_stats: DEXTradeByTokens(
      where: {
        Trade: { Currency: { MintAddress: { is: $tokenMint } } }
        Transaction: { Result: { Success: true } }
        Block: { Time: { since: "2024-12-04T00:00:00Z" } } # last 24h
      }
    ) {
      current_volume_usd: sum(of: Trade_Side_AmountInUSD)
    }
  }
}
`;



export const metadataQuery = `
query GetTokenMetadataByMintAddresses($mintAddresses: [String!]) {
  Solana {
    DEXPools(
      where: {
        Pool: {
          Market: {
            BaseCurrency: { MintAddress: { in: $mintAddresses } }
          }
        }
      }
      limitBy: { by: Pool_Market_BaseCurrency_MintAddress, count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Pool {
        Market {
          BaseCurrency {
            MintAddress
            Name
            Symbol
            Uri
          }
        }
      }
    }
  }
}
 `;




export const TOKEN_DETAIL = `
query TokenMarketCapAndPriceChange($mintAddresses: [String!]) {
  Solana {
    # --- Market Cap & Supply ---
    TokenSupplyUpdates(
      where: { TokenSupplyUpdate: { Currency: { MintAddress: { in: $mintAddresses } } } }
      limitBy: { by: [TokenSupplyUpdate_Currency_MintAddress], count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      TokenSupplyUpdate {
        Currency {
          MintAddress
        }
        PostBalance        # Total supply
        PostBalanceInUSD   # Market cap
      }
    }

    # --- Current Price (Latest) ---
    LatestPrice: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { Currency: { MintAddress: { in: $mintAddresses } } }
      }
      limitBy: { by: [Trade_Currency_MintAddress], count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Trade {
        Currency {
          MintAddress
        }
        PriceInUSD
      }
    }

    # --- 24h Price Change ---
    PriceChange24h: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { Currency: { MintAddress: { in: $mintAddresses } } }
        Block: { Time: { since_relative: { hours_ago: 24 } } }
      }
    ) {
      Trade {
        Currency {
          MintAddress
        }
        CurrentPrice: PriceInUSD(maximum: Block_Time)
        Price24hAgo: PriceInUSD(minimum: Block_Time)
      }
      PriceChange24h: calculate(
        expression: "(($Trade_CurrentPrice - $Trade_Price24hAgo) / $Trade_Price24hAgo) * 100"
      )
    }
  }
}
`;
export const COMBINED_TOKEN_METRICS = `
query CombinedTokenMetrics($mintAddresses: [String!]) {
  Solana {
    # --- Market Cap & Supply ---
    TokenSupplyUpdates(
      where: { 
        TokenSupplyUpdate: { 
          Currency: { MintAddress: { in: $mintAddresses } } 
        } 
      }
    ) {
      uniq(of: TokenSupplyUpdate_Currency_MintAddress)
      TokenSupplyUpdate {
        Currency {
          MintAddress
          Name
          Symbol
        }
        PostBalance(maximum: Block_Time)
        PostBalanceInUSD(maximum: Block_Time)
      }
    }

    # --- Current Price ---
    PriceMetrics: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { in: $mintAddresses } }
        }
      }
    ) {
      uniq(of: Trade_Currency_MintAddress)
      Trade {
        Currency {
          MintAddress
        }
        PriceInUSD(maximum: Block_Time)
      }
    }

    # --- 24h Price Change ---
    PriceChange24h: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { in: $mintAddresses } }
        }
        Block: { Time: { since_relative: { hours_ago: 24 } } }
      }
    ) {
      uniq(of: Trade_Currency_MintAddress)
      Trade {
        Currency {
          MintAddress
        }
        CurrentPrice: PriceInUSD(maximum: Block_Time)
        Price24hAgo: PriceInUSD(minimum: Block_Time)
      }
      PriceChange24hPercent: calculate(
        expression: "(($Trade_CurrentPrice - $Trade_Price24hAgo) / $Trade_Price24hAgo) * 100"
      )
    }
  }
}
`;
const correct_combined_token_metrics_query = `
query CombinedTokenMetrics($mintAddresses: [String!]) {
  Solana {
    # --- Market Cap & Supply ---
    TokenSupplyUpdates(
      where: { 
        TokenSupplyUpdate: { 
          Currency: { MintAddress: { in: $mintAddresses } } 
        } 
      }
    ) {
      uniq(of: TokenSupplyUpdate_Currency_MintAddress)
      TokenSupplyUpdate {
        Currency {
          MintAddress
          Name
          Symbol
        }
        PostBalance(maximum: Block_Time)
        PostBalanceInUSD(maximum: Block_Time)
      }
    }

    # --- Current Price ---
    PriceMetrics: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { in: $mintAddresses } }
        }
      }
    ) {
      uniq(of: Trade_Currency_MintAddress)
      Trade {
        Currency {
          MintAddress
        }
        PriceInUSD(maximum: Block_Time)
      }
    }

    # --- 24h Price Change ---
    PriceChange24h: DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { in: $mintAddresses } }
        }
        Block: { Time: { since_relative: { hours_ago: 24 } } }
      }
    ) {
      uniq(of: Trade_Currency_MintAddress)
      Trade {
        Currency {
          MintAddress
        }
        CurrentPrice: PriceInUSD(maximum: Block_Time)
        Price24hAgo: PriceInUSD(minimum: Block_Time)
      }
      PriceChange24hPercent: calculate(
        expression: "(($Trade_CurrentPrice - $Trade_Price24hAgo) / $Trade_Price24hAgo) * 100"
      )
    }
  }
}`;
export const LIVE_MARKETCAP = `
subscription LiveMarketCapUpdates($mintAddresses: [String!]) {
  Solana {
    TokenSupplyUpdates(
      where: { 
        TokenSupplyUpdate: { 
          Currency: { MintAddress: { in: $mintAddresses } } 
        } 
      }
    ) {
      TokenSupplyUpdate {
        Currency {
          MintAddress
          Name
        }
        PostBalance        # Total supply
        PostBalanceInUSD   # Market cap
      }

    }
  }
}`;

const searchQuery1 =  `
query SearchTokens($mintAddress: String, $keyword: String) {
  Solana {
    DEXTradeByTokens(
      where: {
        any: [
          # Search by exact mint address
          { Trade: { Currency: { MintAddress: { is: $mintAddress } } } }
          
          # Search by keyword in name (case insensitive)
          { Trade: { Currency: { Name: { includesCaseInsensitive: $keyword } } } }
          
          # Search by keyword in symbol (case insensitive)
          { Trade: { Currency: { Symbol: { includesCaseInsensitive: $keyword } } } }
        ]
        Transaction: { Result: { Success: true } }
      }
      limitBy: { by: Trade_Currency_MintAddress, count: 1 }
      orderBy: { descending: Block_Time }
      limit: { count: 50 }
    ) {
      Trade {
        Currency {
          MintAddress
          Name
          Symbol
          Uri
          Decimals
          TokenStandard
          UpdateAuthority
        }
      }
    }
  }
}`;
const searchQuery2 = `
query SearchTokens($mintAddress: String, $keyword: String) {
  Solana {
    Transfers(
      where: {
        any: [
          # Search by exact mint address
          { Transfer: { Currency: { MintAddress: { is: $mintAddress } } } }
          
          # Search by keyword in name (case insensitive)
          { Transfer: { Currency: { Name: { includesCaseInsensitive: $keyword } } } }
          
          # Search by keyword in symbol (case insensitive)  
          { Transfer: { Currency: { Symbol: { includesCaseInsensitive: $keyword } } } }
        ]
      }
      limitBy: { by: Transfer_Currency_MintAddress, count: 1 }
      limit: { count: 50 }
    ) {
      Transfer {
        Currency {
          MintAddress
          Name
          Symbol
          Uri
          Decimals
          TokenStandard
          UpdateAuthority
          TokenCreator {
            Address
          }
        }
      }
      count
    }
  }
}`;
export const CURRENT_PRICE_OF_TOKEN = `
query MyQuery($mintAddress: String!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: { 
          Currency: { MintAddress: { is: $mintAddress } }
        }
      }
      limitBy: { by: [Trade_Currency_MintAddress], count: 1 }
      orderBy: { descending: Block_Time }
    ) {
      Trade {
        Currency {
          MintAddress
        }
        PriceInUSD
      }
    }
  }
}
`;

const getLatestLiquiditybymarketaddress = `
query GetLatestLiquidityForPool {
  Solana(dataset: realtime) {
    DEXPools(
      where: {
        Pool: {
          Market: {
            MarketAddress: {
              is: "C44xM51jboBu9LBm1szTsftiPKwmzp1AKxbn6na9neMc"
            }
          }
        }
        Transaction: { Result: { Success: true } }
      }
      orderBy: { descending: Block_Slot }
      limit: { count: 1 }
    ) {
      Pool {
        Market {
          MarketAddress
          BaseCurrency {
            MintAddress
            Symbol
            Name
          }
          QuoteCurrency {
            MintAddress
            Symbol
            Name
          }
        }
        Dex {
          ProtocolFamily
          ProtocolName
        }
        Quote {
          PostAmount
          PostAmountInUSD
        }
        Base {
          PostAmount
          PostAmountInUSD
        }
      }
    }
  }
}`;
export const GET_MARKETCAP_OF_TOKEN = `
query TokenMarketCapAndPrice($mintAddress: String!) {
  Solana {
    # --- Supply ---
    TokenSupplyUpdates(
      where: {TokenSupplyUpdate: {Currency: {MintAddress: {is: $mintAddress}}}}
      limit: {count: 1}
      orderBy: {descending: Block_Time}
    ) {
      TokenSupplyUpdate {
        PostBalance
        PostBalanceInUSD
      }
    }

    # --- Latest Price ---
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {is: $mintAddress}}}}
      limit: {count: 1}
      orderBy: {descendingByField: "Block_Time"}
    ) {
      Block {
        Time
      }
      Trade {
        Price
        PriceInUSD
      }
    }
  }
}
`;



const toptokenHolders = `
query GetTopTokenHolders($mintAddress: String!) {
  Solana(dataset: realtime) {
    BalanceUpdates(
      limit: {count: 10}
      orderBy: {descendingByField: "BalanceUpdate_Holding_maximum"}
      where: {BalanceUpdate: {Currency: {MintAddress: {is: $mintAddress}}}, Transaction: {Result: {Success: true}}}
    ) {
      BalanceUpdate {
        Currency {
          Name
          MintAddress
          Symbol
        }
        Account {
          Address
          Token {
            Owner
          }
        }
        Holding: PostBalance(maximum: Block_Slot, selectWhere: {gt: "0"})
        
      }
    }
  }
}
`;
const tradesBuySell = `
query MyQuery {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {is: "Hz3ZjRS8c51XDGFCDu136qbdho7XbAzBGw7JtZ2BFHyd"}}}, Block: {Time: {since_relative: {hours_ago: 10}}}}
    ) {
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
      }
      TradeVolume: sum(of: Trade_Amount)
      total_trades: count
      buy_trades: count(if: {Trade: {Side: {Type: {is: buy}}}})
      sell_trades: count(if: {Trade: {Side: {Type: {is: sell}}}})
      
    }
  }
}
`;
const tokensCount= `
{
  Solana(dataset: combined) {
    DEXTradeByTokens(
      where: {
        Trade: { Currency: { MintAddress: { is: "LGiKAMtb4BuPdhpThjEbNWbDddqdM5FnxMMHqtzpump" } } }
        Transaction: { Result: { Success: true } }
      }
    ) {
      totalTrades: count
      numberOfBuys: count(if: { Trade: { Side: { Type: { is: buy } } } })
      numberOfSells: count(if: { Trade: { Side: { Type: { is: sell } } } })
      buyVolumeToken: sum(of: Trade_Amount, if: { Trade: { Side: { Type: { is: buy } } } })
      sellVolumeToken: sum(of: Trade_Amount, if: { Trade: { Side: { Type: { is: sell } } } })
      totalVolumeToken: sum(of: Trade_Amount)
      buyVolumeUSD: sum(of: Trade_Side_AmountInUSD, if: { Trade: { Side: { Type: { is: buy } } } })
      sellVolumeUSD: sum(of: Trade_Side_AmountInUSD, if: { Trade: { Side: { Type: { is: sell } } } })
      totalVolumeUSD: sum(of: Trade_Side_AmountInUSD)
    }
  }
}`;


const tokenHolders = `
query TokenHolders($mintAddress: String!) {
  Solana {
    BalanceUpdates(
      where: {BalanceUpdate: {Currency: {MintAddress: {is: $mintAddress}}, PostBalance: {gt: "0"}}}
      orderBy: {descending: Block_Time}
      limitBy: {by: BalanceUpdate_Account_Address, count: 1}
    ) {
      HoldersCount: uniq(of: BalanceUpdate_Account_Address)
      # AllHolders: sum(of: HoldersCount)
      TotalSupply: sum(of: BalanceUpdate_PostBalance)
      BalanceUpdate {
        Account {
          Address
        }
        PostBalance
        PostBalanceInUSD
        
      }
    }
  }
}
`;
const tokenBasics = `
query TokenDetails($token: String) {
  Solana {
    token_info: DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {is: $token}}}, Transaction: {Result: {Success: true}}}
      orderBy: {descending: Block_Time}
      limit: {count: 1}
    ) {
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
          Uri
        }
      }
    }
    supply_info: TokenSupplyUpdates(
      where: {TokenSupplyUpdate: {Currency: {MintAddress: {is: $token}}}, Transaction: {Result: {Success: true}}}
      limitBy: {by: TokenSupplyUpdate_Currency_MintAddress, count: 1}
      orderBy: {descending: Block_Time}
    ) {
      TokenSupplyUpdate {
        Supply: PostBalance
        Currency {
          Name
          Symbol
        }
      }
    }
    creation_info: Instructions(
      where: {Instruction: {Accounts: {includes: {Address: {is: "LGiKAMtb4BuPdhpThjEbNWbDddqdM5FnxMMHqtzpump"}}}, Program: {Method: {is: "initializeMint"}}}}
    ) {
      Block {
        Time
        Height
      }
      
    }
  }
}
`;
const volumeOfTokenBy24Hour= `
query MyQuery {
  Solana {
    DEXTradeByTokens(
      where: {Trade: {Currency: {MintAddress: {is: "9YKeGRC5XoaBNusQLG8fZKMQKPcMj1L1E4RffhNBBunz"}}}, Block: {Time: {since_relative: {hours_ago: 1}}}}
    ) {
      # Trade {
      #   Currency {
      #     MintAddress
      #     Name
      #     Symbol
      #   }
      # }
      Trade_volume_1h: sum(of: Trade_Side_AmountInUSD)
    }
  }
}
`;

const creationTimeOfToken = `
query MyQuery {
  Solana {
    Instructions(
      where: {Instruction: {Accounts: {includes: {Address: {is: "49w3MYrcXEYK5d7GccARFJ6NRsjHdGTqFMqGEKJkbonk"}}}, Program: {Method: {is: "create"}, Name: {}}}}
    ) {
      Block {
        Time
      }
      Transaction {
        Signature
        Signer
      }
      Instruction {
        Accounts {
          Address
        }
      }
    }
  }
}
`;

const priceChange_24Hour = `
query SolanaTokenPriceChange1Hour {
  Solana {
    DEXTradeByTokens(
      where: {
        Transaction: { Result: { Success: true } }
        Trade: {
          Currency: { MintAddress: { is: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" } }
        }
        Block: { Time: { since_relative: { hours_ago: 24 } } }
      }
    ) {
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
        CurrentPrice: PriceInUSD(maximum: Block_Time)
        Price_1h_ago: PriceInUSD(
          minimum: Block_Time
          if: { Block: { Time: { since_relative: { hours_ago: 24 } } } }
        )
      }
      
      Price_Change_1h: calculate(
        expression: "(($Trade_CurrentPrice - $Trade_Price_1h_ago) / $Trade_Price_1h_ago) * 100"
      )
    }
  }
}`;
const tokenDetailStats = `
query MyQuery($token: String!) {
  Solana(dataset: realtime) {
    DEXTradeByTokens(
      where: {
        Transaction: {Result: {Success: true}}
        Trade: {
          Currency: {MintAddress: {is: $token}}
          Side: {Currency: {MintAddress: {is: "So11111111111111111111111111111111111111112"}}}
          # Market: {MarketAddress: {is: "FaDoeere161VKUFqcrQEM8it6kSCHKrLyq7wWyPvBkPq"}}
        }
        #  AUTOMATIC 1 HOUR WINDOW
        Block: {Time: {since_relative: {hours_ago: 1}}}
      }
    ) {
      Trade {
        Currency {
          Name
          MintAddress
          Symbol
        }
        start: PriceInUSD(minimum: Block_Time)
        # AUTOMATIC 5 MINUTE WINDOW
        min5: PriceInUSD(
          minimum: Block_Time
          if: {Block: {Time: {since_relative: {minutes_ago: 5}}}}
        )
        end: PriceInUSD(maximum: Block_Time)
        Dex {
          ProtocolName
          ProtocolFamily
          ProgramAddress
        }
        Market {
          MarketAddress
        }
        Side {
          Currency {
            Symbol
            Name
            MintAddress
          }
        }
      }
      makers: count(distinct: Transaction_Signer)
      # AUTOMATIC 5 MINUTE MAKERS
      makers_5min: count(
        distinct: Transaction_Signer
        if: {Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      buyers: count(
        distinct: Transaction_Signer
        if: {Trade: {Side: {Type: {is: buy}}}}
      )
      # AUTOMATIC 5 MINUTE BUYERS
      buyers_5min: count(
        distinct: Transaction_Signer
        if: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      sellers: count(
        distinct: Transaction_Signer
        if: {Trade: {Side: {Type: {is: sell}}}}
      )
      # AUTOMATIC 5 MINUTE SELLERS
      sellers_5min: count(
        distinct: Transaction_Signer
        if: {Trade: {Side: {Type: {is: sell}}}, Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      trades: count
      # AUTOMATIC 5 MINUTE TRADES
      trades_5min: count(if: {Block: {Time: {since_relative: {minutes_ago: 5}}}})
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      # AUTOMATIC 5 MINUTE VOLUME
      traded_volume_5min: sum(
        of: Trade_Side_AmountInUSD
        if: {Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      buy_volume: sum(
        of: Trade_Side_AmountInUSD
        if: {Trade: {Side: {Type: {is: buy}}}}
      )
      # AUTOMATIC 5 MINUTE BUY VOLUME
      buy_volume_5min: sum(
        of: Trade_Side_AmountInUSD
        if: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      sell_volume: sum(
        of: Trade_Side_AmountInUSD
        if: {Trade: {Side: {Type: {is: sell}}}}
      )
      # AUTOMATIC 5 MINUTE SELL VOLUME
      sell_volume_5min: sum(
        of: Trade_Side_AmountInUSD
        if: {Trade: {Side: {Type: {is: sell}}}, Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      buys: count(if: {Trade: {Side: {Type: {is: buy}}}})
      # AUTOMATIC 5 MINUTE BUYS
      buys_5min: count(
        if: {Trade: {Side: {Type: {is: buy}}}, Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
      sells: count(if: {Trade: {Side: {Type: {is: sell}}}})
      # AUTOMATIC 5 MINUTE SELLS
      sells_5min: count(
        if: {Trade: {Side: {Type: {is: sell}}}, Block: {Time: {since_relative: {minutes_ago: 5}}}}
      )
    }
  }
}
`;
const token24hdetailStats= `
query MyQuery($token: String!) {
  Solana(dataset: realtime) {
    DEXTradeByTokens(
      where: {
        Transaction: {Result: {Success: true}}
        Trade: {
          Currency: {MintAddress: {is: $token}}
          Side: {Currency: {MintAddress: {is: "So11111111111111111111111111111111111111112"}}}
          # Market: {MarketAddress: {is: "4AZRPNEfCJ7iw28rJu5aUyeQhYcvdcNm8cswyL51AY9i"}}
        }
        # AUTOMATIC 24 HOUR WINDOW
        Block: {Time: {since_relative: {hours_ago: 24}}}
      }
    ) {
      Trade {
        Currency {
          Name
          MintAddress
          Symbol
        }
        start: PriceInUSD(minimum: Block_Time)
        end: PriceInUSD(maximum: Block_Time)
        Dex {
          ProtocolName
          ProtocolFamily
          ProgramAddress
        }
        Market {
          MarketAddress
        }
        Side {
          Currency {
            Symbol
            Name
            MintAddress
          }
        }
      }
      # 24-HOUR METRICS ONLY
      makers: count(distinct: Transaction_Signer)
      buyers: count(
        distinct: Transaction_Signer
        if: {Trade: {Side: {Type: {is: buy}}}}
      )
      sellers: count(
        distinct: Transaction_Signer
        if: {Trade: {Side: {Type: {is: sell}}}}
      )
      trades: count
      traded_volume: sum(of: Trade_Side_AmountInUSD)
      buy_volume: sum(
        of: Trade_Side_AmountInUSD
        if: {Trade: {Side: {Type: {is: buy}}}}
      )
      sell_volume: sum(
        of: Trade_Side_AmountInUSD
        if: {Trade: {Side: {Type: {is: sell}}}}
      )
      buys: count(if: {Trade: {Side: {Type: {is: buy}}}})
      sells: count(if: {Trade: {Side: {Type: {is: sell}}}})
    }
  }
}`;
export const tokenLiquidity = `
query GetMultipleTokensSOLLiquidity($tokenMints: [String!]!, $solMint: String = "So11111111111111111111111111111111111111112") {
  Solana {
    DEXPools(
      where: {
        Pool: {
          Market: {
            BaseCurrency: {MintAddress: {in: $tokenMints}},
            QuoteCurrency: {MintAddress: {is: $solMint}}
          }
        }
        Transaction: {Result: {Success: true}}
      }
      orderBy: {descending: Block_Time}
      limitBy: {by: Pool_Market_BaseCurrency_MintAddress, count: 1}
    ) {
      Pool {
        Market {
          MarketAddress
          BaseCurrency {
            MintAddress
            Symbol
            Name
          }
          QuoteCurrency {
            MintAddress
            Symbol
            Name
          }
        }
        Dex {
          ProtocolName
        }
        Base {
          PostAmount
          PostAmountInUSD
        }
        Quote {
          PostAmount
          PostAmountInUSD
        }
      }
      Block {
        Time
      }
    }
  }
}
`;

export const GET_TOKEN_HOLDERS_COUNT = `
query GetTokenHolders($mintAddresses: [String!]) {
  Solana {
    BalanceUpdates(
      orderBy: {descendingByField: "BalanceUpdate_Holding_maximum"}
      where: {BalanceUpdate: {Currency: {MintAddress: {in: $mintAddresses}}}}
    ) {
      BalanceUpdate {
        Currency {
          MintAddress
          Name
          Symbol
        }
        Account {
          Address
          Token {
            Owner
          }
        }
        Holding: PostBalance(maximum: Block_Slot, selectWhere: {gt: "0"})
      }
    }
  }
}
`;
export const SINGLE_WALLET_FUNDED_AGE = `
query MyQuery($address: String!) {
  Solana {
    Transfers(
      where: {
        Transfer: {
          Receiver: {
            Address: {
              is: $address
            }
          }
        }
        Transaction: {
          Result: {
            Success: true
          }
        }
      }
      orderBy: {ascending: Block_Time}
      limit: {count: 1}
    ) {
      Block {
        Time
        Slot
      }
      Transfer {
        Amount
        AmountInUSD
        Currency {
          Name
          Symbol
          MintAddress
        }
        Receiver {
          Address
        }
      }
    }
  }
}`;
export const MULTIPLE_WALLET_FUNDED_AGE= `
query MyQuery($addresses: [String!]!) {
  Solana {
    Transfers(
      where: {
        Transfer: {
          Receiver: {
            Address: {
              in: $addresses
            }
          }
        }
        Transaction: {
          Result: {
            Success: true
          }
        }
      }
      orderBy: {ascending: Block_Time}
      limitBy: {by: Transfer_Receiver_Address, count: 1}
    ) {
      Block {
        Time
        Slot
      }
      Transfer {
        Amount
        AmountInUSD
        Currency {
          Name
          Symbol
          MintAddress
        }
        Receiver {
          Address
        }
      }
    }
  }
}`;
export const GET_TOKEN_SNIPERS_QUERY =`
query GetTokenSnipersAndLaunch($tokens: [String!]!) {
  Solana {
    # Get early buyers for each token (potential snipers)
    earlyBuyers: DEXTradeByTokens(
      where: {
        Trade: {
          Currency: {MintAddress: {in: $tokens}}
          Side: {Type: {is: buy}}
        }
        Transaction: {Result: {Success: true}}
      }
      orderBy: {ascending: Block_Time}
      limitBy: {by: Trade_Currency_MintAddress, count: 100}  # First 100 buyers PER TOKEN
    ) {
      Block {
        Time
        Slot
      }
      Trade {
        Account {
          Address  # This is the BUYER address
          Token {
            Owner
          }
        }
        Currency {
          MintAddress  # IMPORTANT: Shows which token
          Name
          Symbol
        }
        Amount  # Token amount bought
        AmountInUSD
        Price
        PriceInUSD
        Side {
          Currency {
            Symbol
            MintAddress
          }
          Amount  # SOL/USDC spent
          AmountInUSD
        }
      }
    }
    
    # Get launch moment for each token (first trade)
    launchMoment: DEXTradeByTokens(
      where: {
        Trade: {Currency: {MintAddress: {in: $tokens}}}
        Transaction: {Result: {Success: true}}
      }
      orderBy: {ascending: Block_Time}
      limitBy: {by: Trade_Currency_MintAddress, count: 1}  # First trade PER TOKEN
    ) {
      Block {
        Time
        Slot
      }
      Trade {
        Currency {
          MintAddress  # IMPORTANT: Shows which token
          Name
          Symbol
        }
        Amount
        Price
        PriceInUSD
      }
    }
  }
}`;
export const TOKEN_TRADES_COUNT = `
query GetTokenSOLTradeStats($tokens: [String!]!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: {MintAddress: {in: $tokens}}
          Side: {
            Currency: {
             MintAddress: {in: [
      "11111111111111111111111111111111",     # Native SOL
      "So11111111111111111111111111111111111111112"  # Wrapped SOL
    ]}
            }
          }
        }
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {
        Currency {
          Name
          Symbol
          MintAddress
        }
        Side {
          Currency {
            Name
            Symbol
            MintAddress
          }
        }
      }
      totalTrades: count
      buyTrades: count(if: {Trade: {Side: {Type: {is: buy}}}})
      sellTrades: count(if: {Trade: {Side: {Type: {is: sell}}}})
    }
  }
}`;
export const TOTAL_VOLUME_BUY_SELL = `
query MyQuery($mintAddresses: [String!]!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {Currency: {MintAddress: {in: $mintAddresses}}}
        Block: {Time: {since_relative: {hours_ago: 1}}}
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {
        Currency {
          MintAddress
          Name
          Symbol
        }
      }
      # CORRECT USD VOLUME CALCULATION
      volume_usd_24h: sum(of: Trade_Side_AmountInUSD)
      
      # ADDITIONAL USEFUL METRICS
      token_amount_traded: sum(of: Trade_Amount)
      average_price_usd: average(of: Trade_PriceInUSD)
      trades_24h: count
      
      # BUY/SELL BREAKDOWN
      buy_volume_usd: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: buy}}}})
      sell_volume_usd: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: sell}}}})
    }
  }
}`;
export const GET_B_C_P_PROTOCOL_FAMILY = `
query GetMemeCoinBondingCurveProgress($tokens: [String!]!) {
  Solana {
    DEXPools(
      # limit: { count: 100 }
      limitBy: { by: Pool_Market_BaseCurrency_MintAddress, count: 1 }
      orderBy: { descending: Block_Slot }
      where: {
        Pool: {
          Market: {
            BaseCurrency: {
              MintAddress: { in: $tokens }
            }
          }
          Dex: {
            ProgramAddress: {
              in: [
                "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  # Pump.fun
                "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",  # LetsBonk.fun
                "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN"   # Trends.fun
              ]
            }
          }
        }
      }
    ) {
      # Fixed: Use the correct variable name that matches the field alias
      PumpFun_BondingCurve_Progress: calculate(
        expression: "100 - ((($Pool_Base_Balance - 206900000) * 100) / 793100000)"
      )
      
      Pool {
        Market {
          MarketAddress
          BaseCurrency {
            MintAddress
            Symbol
            Name
          }
          QuoteCurrency {
            MintAddress
            Symbol
            Name
          }
        }
        Dex {
          ProtocolFamily
          ProtocolName
          ProgramAddress
        }
        Base {
          Balance: PostAmount  # This creates variable $Pool_Base_Balance (not $Pool_Base_PostAmount)
          BalanceInUSD: PostAmountInUSD
        }
        Quote {
          PostAmount
          PriceInUSD
          PostAmountInUSD
        }
      }
    }
  }
}`;

// ✅ New route for fetching BlueChip Meme tokens
export const blacklist = [
// Stablecoins
"USDC","USDT","FDUSD","USDY","USD1","DAI","TUSD","USDD",


// Staking derivatives
"mSOL","JitoSOL","JupSOL","bnSOL","bbSOL","JSOL","BNSOL","hSOL","sSOL","MXSOL","JTO","RENDER","W","SAROS","HNT","DBR","STIK",


// Wrapped assets
"WBTC","WETH","cbBTC","renBTC","SPX",


// Infra/DeFi
"JUP","RAY","ORCA","KMNO","DRIFT","SONIC",
"NEON","HUMA","MPLX","ZBCN","ME","JLP"
];

// --------------------volum1----------------------------
// query GetTokenVolume24hTotal($mintAddress: String!) {
//   Solana {
//     DEXTradeByTokens(
//       where: {
//         Trade: { Currency: { MintAddress: { is: $mintAddress } } }
//         Transaction: { Result: { Success: true } }
//         Block: { Time: { since_relative: { hours_ago: 24 } } }
//       }
//     ) {
//       total_volume_24h_USD: sum(of: Trade_Side_AmountInUSD)
//       # total_trades_count: sum(of: Trade_Side_Count)
//     }
//   }
// }

// -------------------volum2-------------------------
// query GetTokenVolume24hTotal($mintAddress: String!) {
//   Solana {
//     DEXTradeByTokens(
//       where: {
//         Trade: {
//           Currency: {
//             MintAddress: { is: $mintAddress }
//           }
//         }
//         Transaction: { Result: { Success: true } }
//         Block: { Time: { since_relative: { hours_ago: 24 } } }
//       }
//     ) {
//       # 🎯 SINGLE AGGREGATED RESULT
//       total_volume_24h_USD: sum(of: Trade_Side_AmountInUSD)
//       total_trades_count: count
//     }
//   }
// }
// ----------------------liquidity-----------------
// query GetTokenLiquidity($mintAddress: String!) {
//   Solana {
//     # 🎯 TOKEN AS BASE CURRENCY
//     AsBaseCurrency: DEXPools(
//       where: {
//         Pool: {
//           Market: {
//             BaseCurrency: {
//               MintAddress: { is: $mintAddress }
//             }
//           }
//         }
//       }
//       limitBy: { by: Pool_Market_MarketAddress, count: 1 }
//     ) {
//       Pool {
//         Base {
//           PostAmountInUSD
//         }
//         Quote {
//           PostAmountInUSD
//         }
//       }
//       TotalLiquidityUSD: calculate(
//         expression: "$Pool_Base_PostAmountInUSD + $Pool_Quote_PostAmountInUSD"
//       )
//     }
    
//     # 🎯 TOKEN AS QUOTE CURRENCY  
//     AsQuoteCurrency: DEXPools(
//       where: {
//         Pool: {
//           Market: {
//             QuoteCurrency: {
//               MintAddress: { is: $mintAddress }
//             }
//           }
//         }
//       }
//       limitBy: { by: Pool_Market_MarketAddress, count: 1 }
//     ) {
//       Pool {
//         Base {
//           PostAmountInUSD
//         }
//         Quote {
//           PostAmountInUSD
//         }
//       }
//       # TotalLiquidityUSD: calculate(
//       #   expression: "$Pool_Base_PostAmountInUSD + $Pool_Quote_PostAmountInUSD"
//       # )
//     }
//   }
// }

// ------------------------blue chip memes---------------------
// query HighLiquidityTokensSimple {
//   Solana {
//     DEXPools(
//       limit: {count: 100}
//       limitBy: {by: Pool_Market_BaseCurrency_MintAddress, count: 1}
//       where: {
//         Pool: {
//           Base: {PostAmountInUSD: {ge: "10000000"}},
//           Market: {
//             QuoteCurrency: {
//               MintAddress: {
//                 in: [
//                   "So11111111111111111111111111111111111111112",
//                   "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
//                   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
//                 ]
//               }
//             }
//           }
//         }
//       }
//       orderBy: {descending: Pool_Base_PostAmountInUSD}
//     ) {
//       # Token Details
//       Pool {
//         Market {
//           MarketAddress
//           BaseCurrency {
//             MintAddress
//             Name
//             Symbol
//             Decimals
//             Uri
//             UpdateAuthority
//             IsMutable
//             ProgramAddress
//           }
//           QuoteCurrency {
//             MintAddress
//             Name
//             Symbol
//             Decimals
//           }
//         }
        
//         # Liquidity Data
//         Base {
//           PostAmount
//           PostAmountInUSD
//           Price
//           PriceInUSD
//         }
        
//         Quote {
//           PostAmount
//           PostAmountInUSD
//           Price
//           PriceInUSD
//         }
        
//         # DEX Protocol
//         Dex {
//           ProtocolName
//           ProtocolFamily
//           ProgramAddress
//         }
//       }
      
//       # Timing Information
//       Block {
//         Time
//         Date
//       }
//     }
//   }
// }