import { Keypair, PublicKey } from "@solana/web3.js";
import { connection } from "./utils/solana";
import { fetchTokenDetailBatch, getCreationTimeAndSupplyBatch, getCurrentTokenPriceUsd, getMarketMetricsBatch, getTokenHolderStats, getTokenLiquidity, getTokenTradeStats, getWalletFundedAge, timeAgo } from "./utils/tokenRelatedUtils";
import Decimal from "decimal.js";
import bs58 from "bs58";
const tokens = [
    {
        mint: "4ikwYoNvoGEwtMbziUyYBTz1zRM6nmxspsfw9G7Bpump",
        marketAddress: "CmvaHpHYXyMikhfw5xyuKWoxQ2pAny9m5hWZiciT9rx2",
    },
    {
        mint: "GaPbGp23pPuY9QBLPUjUEBn2MKEroTe9Q3M3f2Xpump",
        marketAddress: "8oopi6gVFh4FA1mL5Jj35yRetfpmWiUDTfhCv31gkA3v",
    },
    {
        mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        marketAddress: "5hinZuqbN8Va93CMWSHZJBAUKdgN99FXAD2g3spnHy7N",
    },
];

const mintAddresses = [
    "s8obkxYJYBRZedZnmns1qAN9HrTko5dAP1fr9oxpump",
    "EVJ5xPVNXdjfVKtPYP2V99vCAPDpUVAopSeTcZJ9pump"
];

async function main() {
    // const enrichedTokens = await fetchTokenDetailBatch(tokens);
    // const result = await getCreationTimeAndSupplyBatch(mintAddresses);
    // console.log("result: ", result);

    // const count = await getTokenTradeStats([
    //     "5VwhTtRXBdgwwLG5otSq62jdNDm62VC9J72dhC3rpump",
    //     "7tAWbTqpvcrwUkky36SvXwThBTnbV5uP6nhUbCpMQWtW"
    // ]
    // );

    // console.log("holderCount:", count);
    // console.log(timeAgo("2025-12-13 18:59:00+00"));
    // const price = new Decimal( await getCurrentTokenPriceUsd('23iUeVHjLCeSMkuL45ksq5UCpwJMBnTMdF97YKZVDZU9'));
    // console.log("price: ", price);

    // const result = await getMarketMetricsBatch(['2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', ]);
    // console.log("result ", result);

    // const result = await getTokenLiquidity(['jx4PF2MwC7AK9S8dTeYm29hM3vAN8Rtfs2VX4Vz5UVj', '2m6Z89mtnszKJG9LCRBYc2fMBExrhzpETfA5X7ZVBAGS']);
    // console.log("result ", result);

    // const holdersResponse = await getTokenHolderStats(['GPzTPm1seTaPDYEq3gYZX8RPv9fVFAmYHesXLWjnC8Qi']);
    // console.log("holders stats: ", holdersResponse);
    // console.log(
    //     // JSON.stringify(holdersResponse.top10Holders, null, 2)
    // );
    // const tokenmint = new PublicKey('Ci4uY5WmLLJQFfTGjP9b6SsS9qDVyGH1DzrPQMkZB8rg');
    // const response = await connection.getParsedAccountInfo(tokenmint);
    // if ('parsed' in response.value!.data) {
    //     console.log("Dev info:", response.value!.data.parsed);
    // } else {
    //     console.log("Raw buffer:", response.value!.data);
    // }
    // const accountInfo = await getAccountInfo(tokenmint)
    // const wallets = [
    //     '6SMqdsw5TU2GyPMJa4BBGSfq5Smibbn1oYkNr7i5ZBJQ'
    // ];
    // const walletAge= await getWalletFundedAge(wallets);
    // console.log("wallet age: ",walletAge);

    // const locale = navigator.language; // e.g. "en-US", "ur-PK"
    // console.log("local: ", locale);
    // const [, country] = locale.split("-");
    // console.log("country: ", country);
    // const privatekey = '2DvM1GBPrqByEvFA4kiFgV7fvKugPZb4BkA5QwAjiNPPM8XNC9hNqExUj2vrSKJKMtziaseoEuhRmvk7Le8nGfPt';
    // const jsonArray = Array.from(privatekey);
    // console.log("jsonArray: ", jsonArray);


    const base58Key =
        "4TaYKzrGkWhQVeEeohqDwcjK4xL1YJ9hqqghXwcZ9FBBgiYqtKGKx9zjc2pVjginCKRagJqnyUY5FbdbHdJxdUG1";

    // Decode base58 → 64 bytes
    const secretKeyBytes = bs58.decode(base58Key);
    console.log(secretKeyBytes.length); // MUST be 64

    const keypair = Keypair.fromSecretKey(secretKeyBytes);

    // Convert to JSON array format
    const privateKeyArray = Array.from(keypair.secretKey);
    console.log("privateKey:", privateKeyArray);
}

main();