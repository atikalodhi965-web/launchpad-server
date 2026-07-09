// import { generateAuthorizationSignature } from "@privy-io/server-auth/wallet-api";
// import { Router } from "express";
// import { generateBasicAuthHeader } from '@privy-io/server-auth';

// // Generate a base64-encoded key pair for the recipient
// const exportRoutes = Router();

// const exportWallet = async (req: any, res: any) => {
//     const walletId = 'cmh5wgi0c0419jx0dyqxv5hys';
//     const keypair = await crypto.subtle.generateKey(
//         {
//             name: "ECDH",
//             namedCurve: "P-256"
//         },
//         true,
//         ["deriveKey", "deriveBits"]
//     )
//     console.log("keypair: ", keypair);
//     const [publicKey, privateKey] = await Promise.all([
//         crypto.subtle.exportKey("spki", keypair.publicKey),
//         crypto.subtle.exportKey("pkcs8", keypair.privateKey)
//     ])
//     console.log("publickey: ", publicKey);
//     console.log("privatekey: ", privateKey);

//     const [publicKeyBase64, privateKeyBase64] = [
//         Buffer.from(publicKey).toString("base64"),
//         Buffer.from(privateKey).toString("base64")
//     ]

//     // Create the signature for the request
//     const input = {
//         headers: {
//             "privy-app-id": "cmgmo11sz019tld0cebj5wc1b",
//         },
//         method: "POST",
//         url: `https://api.privy.io/v1/wallets/${walletId}/export`,
//         version: 1,
//         body: {
//             encryption_type: "HPKE",
//             recipient_public_key: publicKeyBase64,
//         },
//     };
//     console.log("input: ", input);
//     const signature = generateAuthorizationSignature({
//         input: input,
//         authorizationPrivateKey: "wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDsc7aJsUTmC0v15BqQ1+Slnst5Pdty65wWz/eZBKzPihRANCAAQY9vrSy7kRlVOKQ47LDTpBliYJooMqm86TP6rofV/pq4ubbhsukvS4hOl4KrJHJVJ0rcGViPbCqcp36ikFy0QB" // This should be the private key of your authorization key
//     })
//     console.log("signature: ", signature);
//     // Make the request to export the wallet
//     const resp = await fetch(
//         `https://api.privy.io/v1/wallets/${walletId}/export`,
//         {
//             method: input.method,
//             headers: {
//                 ...input.headers,
//                 "Content-Type": "application/json",
//                 "privy-authorization-signature": signature as string,
//                 // Authorization: generateBasicAuthHeader(
//                 //     "cmgmo11sz019tld0cebj5wc1b",
//                 //     "kExpdmpjXpvgeQXgVsuippYSZsZcAwGXNpmKZpReVGXCfde8orEbGrxHkvRFj3x4DwxU7rWbVPRRman9a2P25Gh"
//                 // ),
//             },
//             body: JSON.stringify(input.body),
//         }
//     );
//     console.log("response: ", resp);
//     res.json({ data: resp });

// }

// const getWalletTransactions = async () => {
//     const url = 'https://api.privy.io/v1/wallets/cmh2301el02thjv0czee8v07l/transactions?chain=base&asset=sol';
//     const options = {
//         method: 'GET',
//         headers: {
//             Authorization: 'Basic Y3h6bG91MHN4a2E3azlpazM5dDdqMG9wOg==',
//             'privy-app-id': 'cmgmo11sz019tld0cebj5wc1b'
//         },
//         body: undefined
//     };

//     try {
//         const response = await fetch(url, options);
//         console.log("response: ", response);
//         const data = await response.json();
//         console.log("data: ", data);
//         console.log(data);
//     } catch (error) {
//         console.error(error);
//     }
// }

// exportRoutes.post('/exportWallet', getWalletTransactions);

// export default exportRoutes;