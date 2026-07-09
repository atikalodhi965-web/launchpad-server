// src/services/bitqueryService.ts

import fetch from "node-fetch";

const BITQUERY_ENDPOINT = "https://graphql.bitquery.io";
const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;

const SIMPLE_PAST_TRADES_QUERY = `
  query SimplePastTrades($walletAddresses: [String!]) {
    Solana {
      DEXTradeByTokens(
        limit: {count: 20}
        orderBy: {descending: Block_Time}
        where: {
          Transaction: {Result: {Success: true}}
          Trade: {
            Currency: {
              Fungible: true
              MintAddress: {
                notIn: [
                  "So11111111111111111111111111111111111111112",
                  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
                  "11111111111111111111111111111111"
                ]
              }
            }
            Amount: {gt: "0"}
          }
          any: [
            {Trade: {Account: {Address: {in: $walletAddresses}}}},
            {Transaction: {Signer: {in: $walletAddresses}}}
          ]
        }
      ) {
        Block { Time }
        Trade {
          Currency {
            Name
            Symbol
            MintAddress
          }
          Amount
          Price
          PriceInUSD
          Side {
            Type
            Amount
            AmountInUSD
          }
          Account {
            Address
            Token { Owner }
          }
        }
      }
    }
  }
`;

export async function getPastTrades(walletAddresses: string[]) {
  try {
    const response = await fetch(BITQUERY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": BITQUERY_API_KEY || "ory_at_eARFbhq1K4YgXrPcag0VgsTPqheKtNEusMgVlKoGgLY.2ecMnoveStBDtSikLRVJ_-MjxFdut_RS-26BMMbs3SQ",
      },
      body: JSON.stringify({
        query: SIMPLE_PAST_TRADES_QUERY,
        variables: { walletAddresses },
      }),
    });

    const { data, errors } = await response.json();
    if (errors) {
      console.error("Bitquery Errors:", errors);
      throw new Error("Failed to fetch past trades");
    }

    return data?.Solana?.DEXTradeByTokens ?? [];
  } catch (err) {
    console.error("Error fetching past trades:", err);
    return [];
  }
}
