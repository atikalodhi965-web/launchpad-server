import { PublicKey, Connection, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import { DynamicBondingCurveClient, MigratedCollectFeeMode, deriveDbcPoolAddress } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import * as types from './types';
import bs58 from 'bs58';
import { METEORA_DBC_PROGRAM_ID } from '../../utils/connection';
// import { buildCurveWithMarketCap } from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  buildCurveWithMarketCap, MigrationOption, TokenDecimal, BaseFeeMode, ActivationType, CollectFeeMode, MigrationFeeOption, TokenType
  , TokenUpdateAuthorityOption, DammV2DynamicFeeMode
} from '@meteora-ag/dynamic-bonding-curve-sdk';
// Add environment variable imports

const COMMISSION_WALLET = process.env.COMMISSION_WALLET || '9nD1tYqzohcYwmnxEwq3fRBs1WBavDVQbTWbsRBC5SND';
const COMMISSION_PERCENTAGE = parseFloat(process.env.COMMISSION_PERCENTAGE || '0.005'); // Default to 0.5%
const COMMISSION_AMOUNT = parseInt(process.env.COMMISSION_AMOUNT || '5000000', 10); // Default to 0.005 SOL in lamports
const MIN_COMMISSION = parseInt(process.env.MIN_COMMISSION || '1000000', 10); // Default to 0.001 SOL
const MAX_COMMISSION = parseInt(process.env.MAX_COMMISSION || '10000000', 10); // Default to 0.01 SOL

export class MeteoraDBCService {
  private client: DynamicBondingCurveClient;

  constructor(connection: Connection) {
    this.client = new DynamicBondingCurveClient(connection, 'confirmed');
    console.log(`Initialized Meteora DBC client with program ID: ${METEORA_DBC_PROGRAM_ID.toString()}`);
  }

  /**
   * Convert a string PublicKey to PublicKey object
   */
  private toPublicKey(key: string): PublicKey {
    return new PublicKey(key);
  }

  /**
   * Convert a string to BN
   */
  private toBN(value: string | number): BN {
    try {
      // Make sure we're working with a string
      const valueStr = String(value);
      console.log(`Converting to BN: ${valueStr}`);

      // Check if it looks like a hexadecimal value (starts with 0x)
      if (valueStr.toLowerCase().startsWith('0x')) {
        return new BN(valueStr.slice(2), 16);
      }

      // Check if it could be an unintentional hex value (all hex chars)
      const hexRegex = /^[0-9a-f]+$/i;
      if (hexRegex.test(valueStr) && isNaN(Number(valueStr))) {
        console.log(`Detected possible hex string: ${valueStr}, converting as hex`);
        return new BN(valueStr, 16);
      }

      // Check if it contains a decimal point
      if (valueStr.includes('.')) {
        // Convert float to integer considering decimals
        const floatVal = parseFloat(valueStr);
        if (isNaN(floatVal)) {
          throw new Error(`Invalid amount format: ${valueStr}`);
        }

        // Default to 9 decimals (like for SOL)
        const decimals = 9;
        const intVal = Math.floor(floatVal * Math.pow(10, decimals));
        return new BN(intVal.toString());
      } else {
        // If it's already an integer string with no decimal, just use it directly
        return new BN(valueStr);
      }
    } catch (error) {
      console.error('Error converting to BN:', error, 'Value:', value);
      throw new Error(`Failed to convert value to BN: ${value}`);
    }
  }

  /**
   * Serialize a transaction to base64 string
   */
  private serializeTransaction(transaction: Transaction): string {
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    return serializedTransaction.toString('base64');
  }

  /**
   * Ensure transaction has a recent blockhash and serialize it to base64 string
   */
  private async prepareTransaction(transaction: Transaction): Promise<string> {
    // Get a recent blockhash if not already set
    if (!transaction.recentBlockhash) {
      const { blockhash } = await this.client.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
    }

    // Ensure there's a fee payer set
    if (!transaction.feePayer) {
      // For the transaction to serialize, we need to set a temporary fee payer
      // The actual fee payer will be set on the client side when the user signs
      const instructions = transaction.instructions;
      if (instructions.length > 0 && instructions[0].keys.length > 0) {
        // Use the first signer from the first instruction as a temporary fee payer
        const firstSigner = instructions[0].keys.find(key => key.isSigner);
        if (firstSigner) {
          transaction.feePayer = firstSigner.pubkey;
        }
      }
    }

    // Check if we have a fee payer set
    if (!transaction.feePayer) {
      throw new Error("Transaction fee payer required");
    }

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    return serializedTransaction.toString('base64');
  }

  /**
   * Helper method to create and prepare a transaction
   * This centralizes transaction creation logic with proper blockhash handling
   */
  private async createAndPrepareTransaction<T>(
    createTransactionFn: () => Promise<Transaction>,
    additionalData: T = {} as T
  ): Promise<types.ApiResponse & T> {
    try {
      // Create the transaction
      const transaction = await createTransactionFn();

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
        ...additionalData
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...additionalData
      };
    }
  }

  /**
   * Create a configuration for Dynamic Bonding Curve
   */
  // async createConfig(params: types.CreateConfigParam): Promise<types.ApiResponse> {
  //   try {
  //     const transaction = await this.client.partner.createConfig({
  //       payer: this.toPublicKey(params.payer),
  //       config: this.toPublicKey(params.config),
  //       feeClaimer: this.toPublicKey(params.feeClaimer),
  //       leftoverReceiver: this.toPublicKey(params.leftoverReceiver),
  //       quoteMint: this.toPublicKey(params.quoteMint),
  //       poolFees: {
  //         baseFee: {
  //           cliffFeeNumerator: this.toBN(params.poolFees.baseFee.cliffFeeNumerator),
  //           numberOfPeriod: params.poolFees.baseFee.numberOfPeriod,
  //           reductionFactor: this.toBN(params.poolFees.baseFee.reductionFactor),
  //           periodFrequency: this.toBN(params.poolFees.baseFee.periodFrequency),
  //           feeSchedulerMode: params.poolFees.baseFee.feeSchedulerMode,
  //         },
  //         dynamicFee: params.poolFees.dynamicFee ? {
  //           binStep: params.poolFees.dynamicFee.binStep,
  //           binStepU128: this.toBN(params.poolFees.dynamicFee.binStepU128),
  //           filterPeriod: params.poolFees.dynamicFee.filterPeriod,
  //           decayPeriod: params.poolFees.dynamicFee.decayPeriod,
  //           reductionFactor: params.poolFees.dynamicFee.reductionFactor,
  //           variableFeeControl: params.poolFees.dynamicFee.variableFeeControl,
  //           maxVolatilityAccumulator: params.poolFees.dynamicFee.maxVolatilityAccumulator,
  //         } : null,
  //       },
  //       activationType: params.activationType,
  //       collectFeeMode: params.collectFeeMode,
  //       migrationOption: params.migrationOption,
  //       tokenType: params.tokenType,
  //       tokenDecimal: params.tokenDecimal,
  //       migrationQuoteThreshold: this.toBN(params.migrationQuoteThreshold),
  //       partnerLpPercentage: params.partnerLpPercentage,
  //       creatorLpPercentage: params.creatorLpPercentage,
  //       partnerLockedLpPercentage: params.partnerLockedLpPercentage,
  //       creatorLockedLpPercentage: params.creatorLockedLpPercentage,
  //       sqrtStartPrice: this.toBN(params.sqrtStartPrice),
  //       lockedVesting: {
  //         amountPerPeriod: this.toBN(params.lockedVesting.amountPerPeriod),
  //         cliffDurationFromMigrationTime: this.toBN(params.lockedVesting.cliffDurationFromMigrationTime),
  //         frequency: this.toBN(params.lockedVesting.frequency),
  //         numberOfPeriod: this.toBN(params.lockedVesting.numberOfPeriod),
  //         cliffUnlockAmount: this.toBN(params.lockedVesting.cliffUnlockAmount),
  //       },
  //       migrationFeeOption: params.migrationFeeOption,
  //       tokenSupply: params.tokenSupply ? {
  //         preMigrationTokenSupply: this.toBN(params.tokenSupply.preMigrationTokenSupply),
  //         postMigrationTokenSupply: this.toBN(params.tokenSupply.postMigrationTokenSupply),
  //       } : null,
  //       creatorTradingFeePercentage: params.creatorTradingFeePercentage,
  //       padding0: [],
  //       padding1: [],
  //       curve: params.curve.map(curve => ({
  //         sqrtPrice: this.toBN(curve.sqrtPrice),
  //         liquidity: this.toBN(curve.liquidity),
  //       })),
  //     });

  //     // Prepare the transaction with a blockhash and serialize it
  //     const serializedTransaction = await this.prepareTransaction(transaction);

  //     return {
  //       success: true,
  //       transaction: serializedTransaction,
  //     };
  //   } catch (error) {
  //     console.error('Error in createConfig:', error);
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'Unknown error',
  //     };
  //   }
  // }

  // async myTestFunc() {
  //   try {
  //     // 1️⃣ Generate new config account keypair
  //     const configKeypair = Keypair.generate();
  //     const configPubkey = configKeypair.publicKey;
  //     console.log("Generated Config Pubkey:", configPubkey.toString());

  //     // 2️⃣ Build curve config with hardcoded params
  //     const curveConfig = buildCurveWithMarketCap({
  //       totalTokenSupply: 1_000_000_000,
  //       initialMarketCap: 100,
  //       migrationMarketCap: 3000,
  //       migrationOption: MigrationOption.MET_DAMM_V2,
  //       tokenBaseDecimal: TokenDecimal.SIX,
  //       tokenQuoteDecimal: TokenDecimal.NINE,
  //       lockedVestingParam: {
  //         totalLockedVestingAmount: 0,
  //         numberOfVestingPeriod: 0,
  //         cliffUnlockAmount: 0,
  //         totalVestingDuration: 0,
  //         cliffDurationFromMigrationTime: 0,
  //       },
  //       baseFeeParams: {
  //         baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
  //         feeSchedulerParam: {
  //           startingFeeBps: 100,
  //           endingFeeBps: 100,
  //           numberOfPeriod: 0,
  //           totalDuration: 0,
  //         },
  //       },
  //       dynamicFeeEnabled: true,
  //       activationType: ActivationType.Slot,
  //       collectFeeMode: CollectFeeMode.QuoteToken,
  //       migrationFeeOption: MigrationFeeOption.Customizable,
  //       tokenType: TokenType.SPL,
  //       partnerLpPercentage: 0,
  //       creatorLpPercentage: 0,
  //       partnerLockedLpPercentage: 100,
  //       creatorLockedLpPercentage: 0,
  //       creatorTradingFeePercentage: 0,
  //       leftover: 0,
  //       tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
  //       migrationFee: {
  //         feePercentage: 0,
  //         creatorFeePercentage: 0,
  //       },
  //       migratedPoolFee: {
  //         collectFeeMode: CollectFeeMode.QuoteToken,
  //         dynamicFee: DammV2DynamicFeeMode.Enabled,
  //         poolFeeBps: 250,
  //       },
  //     });

  //     // 3️⃣ Define fixed addresses
  //     const feeClaimer = new PublicKey("FfGV6BR1Jk9dJRq59xFi4G2fQRcieCFTxmD5AB6t2gwv");
  //     const leftoverReceiver = new PublicKey("FfGV6BR1Jk9dJRq59xFi4G2fQRcieCFTxmD5AB6t2gwv");
  //     const payer = new PublicKey("8eBuwmzy1KJxV8NPRg52Ks2Da7KZ8DcwNf37yXw9GrNJ");
  //     const quoteMint = new PublicKey("So11111111111111111111111111111111111111112");

  //     // 4️⃣ Build transaction
  //     let transaction = await this.client.partner.createConfig({
  //       config: configPubkey, // use generated keypair
  //       feeClaimer,
  //       leftoverReceiver,
  //       payer,
  //       quoteMint,
  //       ...curveConfig,
  //     });

  //     // 5️⃣ Add commission transfer (optional)
  //     const commissionWallet = new PublicKey(COMMISSION_WALLET);
  //     const fixedCommissionAmount = COMMISSION_AMOUNT;

  //     const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(fixedCommissionAmount, MAX_COMMISSION));
  //     console.log(`[buildCurveAndCreateConfigByMarketCap] Adding commission of ${finalCommissionAmount / 1_000_000_000} SOL to:`, commissionWallet.toString());

  //     const transferIx = SystemProgram.transfer({
  //       fromPubkey: payer,
  //       toPubkey: commissionWallet,
  //       lamports: finalCommissionAmount,
  //     });

  //     transaction.add(transferIx);

  //     // 6️⃣ Set blockhash & fee payer
  //     transaction.feePayer = payer;
  //     if (!transaction.recentBlockhash) {
  //       const { blockhash } = await this.client.connection.getLatestBlockhash();
  //       transaction.recentBlockhash = blockhash;
  //     }

  //     // 7️⃣ Partial sign with config keypair
  //     transaction.partialSign(configKeypair);

  //     // 8️⃣ Serialize for frontend
  //     // const serializedTransaction = transaction.serialize({
  //     //   requireAllSignatures: false,
  //     //   verifySignatures: false,
  //     // }).toString("base64");
  //     const serializedTransaction = await this.prepareTransaction(transaction);

  //     return {
  //       success: true,
  //       transaction: serializedTransaction, // frontend will sign & send
  //       configAddress: configPubkey.toString(),
  //     };
  //   } catch (error) {
  //     console.error("Error in myTestFunc:", error);
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     };
  //   }
  // }

  /**
   * Build curve and create config
   */
  // async buildCurveAndCreateConfig(params: types.BuildCurveAndCreateConfigParam): Promise<types.ApiResponse> {
  //   try {
  //     const transaction = await this.client.partner.buildCurveAndCreateConfig({
  //       buildCurveParam: {
  //         totalTokenSupply: params.buildCurveParam.totalTokenSupply,
  //         percentageSupplyOnMigration: params.buildCurveParam.percentageSupplyOnMigration,
  //         migrationQuoteThreshold: params.buildCurveParam.migrationQuoteThreshold,
  //         migrationOption: params.buildCurveParam.migrationOption,
  //         tokenBaseDecimal: params.buildCurveParam.tokenBaseDecimal,
  //         tokenQuoteDecimal: params.buildCurveParam.tokenQuoteDecimal,
  //         lockedVesting: {
  //           amountPerPeriod: this.toBN(params.buildCurveParam.lockedVesting.amountPerPeriod),
  //           cliffDurationFromMigrationTime: this.toBN(params.buildCurveParam.lockedVesting.cliffDurationFromMigrationTime),
  //           frequency: this.toBN(params.buildCurveParam.lockedVesting.frequency),
  //           numberOfPeriod: this.toBN(params.buildCurveParam.lockedVesting.numberOfPeriod),
  //           cliffUnlockAmount: this.toBN(params.buildCurveParam.lockedVesting.cliffUnlockAmount),
  //         },
  //         feeSchedulerParam: {
  //           numberOfPeriod: params.buildCurveParam.feeSchedulerParam.numberOfPeriod,
  //           reductionFactor: params.buildCurveParam.feeSchedulerParam.reductionFactor,
  //           periodFrequency: params.buildCurveParam.feeSchedulerParam.periodFrequency,
  //           feeSchedulerMode: params.buildCurveParam.feeSchedulerParam.feeSchedulerMode,
  //         },
  //         baseFeeBps: params.buildCurveParam.baseFeeBps,
  //         dynamicFeeEnabled: params.buildCurveParam.dynamicFeeEnabled,
  //         activationType: params.buildCurveParam.activationType,
  //         collectFeeMode: params.buildCurveParam.collectFeeMode,
  //         migrationFeeOption: params.buildCurveParam.migrationFeeOption,
  //         tokenType: params.buildCurveParam.tokenType,
  //         partnerLpPercentage: params.buildCurveParam.partnerLpPercentage,
  //         creatorLpPercentage: params.buildCurveParam.creatorLpPercentage,
  //         partnerLockedLpPercentage: params.buildCurveParam.partnerLockedLpPercentage,
  //         creatorLockedLpPercentage: params.buildCurveParam.creatorLockedLpPercentage,
  //         creatorTradingFeePercentage: params.buildCurveParam.creatorTradingFeePercentage,
  //       },
  //       feeClaimer: this.toPublicKey(params.feeClaimer),
  //       leftoverReceiver: this.toPublicKey(params.leftoverReceiver),
  //       payer: this.toPublicKey(params.payer),
  //       quoteMint: this.toPublicKey(params.quoteMint),
  //       config: this.toPublicKey(params.config),
  //     });

  //     // Prepare the transaction with a blockhash and serialize it
  //     const serializedTransaction = await this.prepareTransaction(transaction);

  //     return {
  //       success: true,
  //       transaction: serializedTransaction,
  //     };
  //   } catch (error) {
  //     console.error('Error in buildCurveAndCreateConfig:', error);
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'Unknown error',
  //     };
  //   }
  // }

  /**
   * Build curve by market cap and create config
   */
  async buildCurveAndCreateConfigByMarketCap(params: types.BuildCurveAndCreateConfigByMarketCapParam): Promise<types.ApiResponse> {
    try {
      // Generate a new keypair for the config account
      const configKeypair = Keypair.generate();
      const configPubkey = configKeypair.publicKey;
      console.log('Building curve with params. Using new config keypair:', configPubkey.toString());
      // Fixed token fields in raw units (scaled by decimals)
      // const LAMPORTS_PER_SOL = 1_000_000_000
      // const FIXED_TOTAL_SUPPLY = 1_000_000_000; // 1B tokens scaled by 6 decimals
      // const FIXED_INITIAL_MCAP = 100 * LAMPORTS_PER_SOL;      // 100 SOL in lamports
      // const FIXED_MIGRATION_MCAP = 3000 * LAMPORTS_PER_SOL;    // 3000 SOL in lamports
      // const FIXED_MIGRATION_OPTION = MigrationOption.MET_DAMM_V2;
      // const FIXED_BASE_DECIMAL = TokenDecimal.SIX;
      // const FIXED_QUOTE_DECIMAL = TokenDecimal.NINE;

      // Handle Launch Mode fee logic
      let baseFeeBps = 100; // Default
      let creatorTradingFeePercentage = 0; // Default
      let migratedPoolFeeBps = 100; // Default 1%

      if (params.launchMode === 'founder') {
        baseFeeBps = 100; // 1% curve fee
        creatorTradingFeePercentage = 100; // 100% of the fee goes to creator
        migratedPoolFeeBps = 100; // 1% pool fee
      } else if (params.launchMode === 'paperhand') {
        baseFeeBps = 100; // 10% curve fee
        creatorTradingFeePercentage = 50; // 50% of the fee (5% of volume) goes to creator
        migratedPoolFeeBps = 100; // 10% pool fee
      }
      // console.log({
      //   totalTokenSupply: FIXED_TOTAL_SUPPLY.toString(),
      //   initialMarketCap: FIXED_INITIAL_MCAP.toString(),
      //   migrationMarketCap: FIXED_MIGRATION_MCAP.toString(),
      //   baseDecimals: 6,
      //   quoteDecimals: 9,
      // });

      const curveConfig = buildCurveWithMarketCap({
        token: {
          tokenType: TokenType.Token2022,
          tokenBaseDecimal: TokenDecimal.SIX,
          tokenQuoteDecimal: TokenDecimal.NINE,
          tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
          totalTokenSupply: 1000000000000000,
          leftover: 0,
        },
        fee: {
          baseFeeParams: {
            baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
            feeSchedulerParam: {
              startingFeeBps: 100,
              endingFeeBps: 100,
              numberOfPeriod: 0,
              totalDuration: 0,
            },
          },
          dynamicFeeEnabled: false,
          collectFeeMode: CollectFeeMode.QuoteToken,
          creatorTradingFeePercentage: 100,
          poolCreationFee: 0,
          enableFirstSwapWithMinFee: false,
        },
        migration: {
          migrationOption: MigrationOption.MET_DAMM_V2,
          migrationFeeOption: MigrationFeeOption.Customizable,
          migrationFee: {
            feePercentage: 50,
            creatorFeePercentage: 50
          },
          migratedPoolFee: {
            collectFeeMode: MigratedCollectFeeMode.QuoteToken,
            dynamicFee: DammV2DynamicFeeMode.Enabled,
            poolFeeBps: 200,
          },
        },
        liquidityDistribution: {
          partnerLiquidityPercentage: 0,
          partnerPermanentLockedLiquidityPercentage: 100,
          creatorLiquidityPercentage: 0,
          creatorPermanentLockedLiquidityPercentage: 0,
        },
        lockedVesting: {
          totalLockedVestingAmount: 0,
          numberOfVestingPeriod: 0,
          cliffUnlockAmount: 0,
          totalVestingDuration: 0,
          cliffDurationFromMigrationTime: 0,
        },
        activationType: ActivationType.Slot,
        initialMarketCap: 90,
        migrationMarketCap: 300,
      });

      // const curveConfig = buildCurveWithMarketCap({
      //   totalTokenSupply: 1000_000_000,
      //   initialMarketCap: 100,
      //   migrationMarketCap: 3000,
      //   migrationOption: MigrationOption.MET_DAMM_V2,
      //   tokenBaseDecimal: TokenDecimal.SIX,
      //   tokenQuoteDecimal: TokenDecimal.NINE,
      //   lockedVestingParam: {
      //     totalLockedVestingAmount: 0,
      //     numberOfVestingPeriod: 0,
      //     cliffUnlockAmount: 0,
      //     totalVestingDuration: 0,
      //     cliffDurationFromMigrationTime: 0,
      //   },
      //   baseFeeParams: {
      //     baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      //     feeSchedulerParam: {
      //       startingFeeBps: 100,
      //       endingFeeBps: 100,
      //       numberOfPeriod: 0,
      //       totalDuration: 0,
      //     },
      //   },
      //   dynamicFeeEnabled: false,
      //   activationType: ActivationType.Slot,
      //   collectFeeMode: CollectFeeMode.QuoteToken,
      //   migrationFeeOption: MigrationFeeOption.FixedBps100,
      //   tokenType: TokenType.SPL,
      //   partnerLpPercentage: 0,
      //   creatorLpPercentage: 0,
      //   partnerLockedLpPercentage: 100,
      //   creatorLockedLpPercentage: 0,
      //   creatorTradingFeePercentage: 100,
      //   leftover: 0,
      //   tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
      //   migrationFee: {
      //     feePercentage: 1.5, // 150 bps instead of 1.5 to prevent type errors
      //     creatorFeePercentage: 50,
      //   },
      //   migratedPoolFee: {
      //     collectFeeMode: CollectFeeMode.QuoteToken,
      //     dynamicFee: DammV2DynamicFeeMode.Enabled,
      //     poolFeeBps: 250,
      //   },
      // });
      console.log("Curve config built:", curveConfig);

      // 3️⃣ Define fixed addresses
      const feeClaimer = new PublicKey(params.payer);
      const leftoverReceiver = new PublicKey(params.payer);
      // const payer = new PublicKey("9nD1tYqzohcYwmnxEwq3fRBs1WBavDVQbTWbsRBC5SND");
      const payer = new PublicKey(params.payer);
      const quoteMint = new PublicKey("So11111111111111111111111111111111111111112");

      // 4️⃣ Build transaction
      let transaction = await this.client.partner.createConfig({
        config: configPubkey, // use generated keypair
        feeClaimer,
        leftoverReceiver,
        payer,
        quoteMint,
        ...curveConfig,
      });
      console.log('Config created successfully');

      // Add commission to specified wallet from environment variable
      const commissionWallet = new PublicKey(COMMISSION_WALLET);

      // Use fixed commission amount from environment variable
      const fixedCommissionAmount = COMMISSION_AMOUNT;
      console.log("fixed commission amount: ", fixedCommissionAmount);
      // Ensure minimum and maximum commission from environment variables
      const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(fixedCommissionAmount, MAX_COMMISSION));
      console.log("final commission amount after applying min/max: ", finalCommissionAmount);
      console.log(`[buildCurveAndCreateConfigByMarketCap] Adding commission of ${finalCommissionAmount / 1_000_000_000} SOL to:`, commissionWallet.toString());

      // Use SystemProgram.transfer helper
      // const { SystemProgram } = require('@solana/web3.js');
      const transferIx = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: commissionWallet,
        lamports: finalCommissionAmount,
      });
      console.log("Created transfer instruction for commission:", transferIx);
      transaction.add(transferIx);

      // Set the fee payer explicitly
      transaction.feePayer = payer;
      console.log("fee payer added");
      // Get a recent blockhash before trying to sign
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.client.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      // Partial sign the transaction with the config keypair
      transaction.partialSign(configKeypair);

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      const privateKeystring = '3UZXHijBVLW8QLzB3cC3gyoqy3J47jgqiGkBHg1C8jJHUSMsX59yJq5ZzPW6JiEFUkhfGxQo6sVrnSvCc3isAFVf';
      const payerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKeystring));

      transaction.sign(configKeypair, payerKeyPair);
      const rawTx = transaction.serialize();
      const txid = await this.client.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      console.log("tx: ", txid);
      return {
        success: true,
        transaction: txid,
        configAddress: configPubkey.toString(),
        // launchMode: params.launchMode,
        creatorTradingFeePercentage: 100,
        poolFeeBps: 250
      };
    } catch (error) {
      console.error('Error in buildCurveAndCreateConfigByMarketCap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // async buildCurveAndCreateConfigByMarketCap(params: types.BuildCurveAndCreateConfigByMarketCapParam): Promise<types.ApiResponse> {
  //   try {
  //     // Generate a new keypair for the config account
  //     const configKeypair = Keypair.generate();
  //     const configPubkey = configKeypair.publicKey;
  //     console.log('Building curve with params. Using new config keypair:', configPubkey.toString());

  //     const curveConfig = buildCurveWithMarketCap({
  //       token: {
  //         tokenType: TokenType.SPL,
  //         tokenBaseDecimal: TokenDecimal.SIX,
  //         tokenQuoteDecimal: TokenDecimal.NINE,
  //         tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
  //         totalTokenSupply: 1000000000,
  //         leftover: 0,
  //       },
  //       fee: {
  //         baseFeeParams: {
  //           baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
  //           feeSchedulerParam: {
  //             startingFeeBps: 100,
  //             endingFeeBps: 100,
  //             numberOfPeriod: 0,
  //             totalDuration: 0,
  //           },
  //         },
  //         dynamicFeeEnabled: false,
  //         collectFeeMode: CollectFeeMode.QuoteToken,
  //         creatorTradingFeePercentage: 100,
  //         poolCreationFee: 0,
  //         enableFirstSwapWithMinFee: true,
  //       },
  //       migration: {
  //         migrationOption: MigrationOption.MET_DAMM_V2,
  //         migrationFeeOption: MigrationFeeOption.Customizable,
  //         migrationFee: {
  //           feePercentage: 100,
  //           creatorFeePercentage: 50
  //         },
  //         migratedPoolFee: {
  //           collectFeeMode: MigratedCollectFeeMode.QuoteToken,
  //           dynamicFee: DammV2DynamicFeeMode.Enabled,
  //           poolFeeBps: 250,
  //         },
  //       },
  //       liquidityDistribution: {
  //         partnerLiquidityPercentage: 0,
  //         partnerPermanentLockedLiquidityPercentage: 100,
  //         creatorLiquidityPercentage: 0,
  //         creatorPermanentLockedLiquidityPercentage: 0,
  //       },
  //       lockedVesting: {
  //         totalLockedVestingAmount: 0,
  //         numberOfVestingPeriod: 0,
  //         cliffUnlockAmount: 0,
  //         totalVestingDuration: 0,
  //         cliffDurationFromMigrationTime: 0,
  //       },
  //       activationType: ActivationType.Slot,
  //       initialMarketCap: 30,
  //       migrationMarketCap: 100,
  //     });


  //     // const curveConfig = buildCurveWithMarketCap({
  //     //   totalTokenSupply:1_000_000_000, // 1 quadrillion in raw units (scaled by decimals)
  //     //   initialMarketCap: 100,
  //     //   migrationMarketCap: 3000,
  //     //   migrationOption: MigrationOption.MET_DAMM_V2,
  //     //   tokenBaseDecimal: TokenDecimal.SIX,
  //     //   tokenQuoteDecimal: TokenDecimal.NINE,
  //     //   lockedVestingParam: {
  //     //     totalLockedVestingAmount: 1000000,
  //     //     numberOfVestingPeriod: 10,
  //     //     cliffUnlockAmount: 0,
  //     //     totalVestingDuration: 10000,
  //     //     cliffDurationFromMigrationTime: 0,
  //     //   },
  //     //   baseFeeParams: {
  //     //     baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
  //     //     feeSchedulerParam: {
  //     //       startingFeeBps: 120,
  //     //       endingFeeBps: 120,
  //     //       numberOfPeriod: 0,
  //     //       totalDuration: 0,
  //     //     },
  //     //   },
  //     //   dynamicFeeEnabled: false,
  //     //   activationType: ActivationType.Slot,
  //     //   collectFeeMode: CollectFeeMode.QuoteToken,
  //     //   migrationFeeOption: MigrationFeeOption.Customizable,
  //     //   tokenType: TokenType.Token2022,
  //     //   partnerLpPercentage: 55,
  //     //   creatorLpPercentage: 0,
  //     //   partnerLockedLpPercentage: 45,
  //     //   creatorLockedLpPercentage: 0,
  //     //   creatorTradingFeePercentage: 50,
  //     //   leftover: 10_000,
  //     //   tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
  //     //   migrationFee: {
  //     //     feePercentage: 1.5,
  //     //     creatorFeePercentage: 50,
  //     //   },
  //     //   migratedPoolFee: {
  //     //     collectFeeMode: CollectFeeMode.QuoteToken,
  //     //     dynamicFee: DammV2DynamicFeeMode.Enabled,
  //     //     poolFeeBps: 120,
  //     //   },
  //     // });

  //     // 3️⃣ Define fixed addresses


  //     /* fee claimer and leftover receiver should be partner wallet*/
  //     const feeClaimer = new PublicKey(params.payer);
  //     const leftoverReceiver = new PublicKey(params.payer);
  //     // const payer = new PublicKey("9nD1tYqzohcYwmnxEwq3fRBs1WBavDVQbTWbsRBC5SND");
  //     const payer = new PublicKey(params.payer);
  //     const quoteMint = new PublicKey("So11111111111111111111111111111111111111112");

  //     // 4️⃣ Build transaction
  //     let transaction = await this.client.partner.createConfig({
  //       config: configPubkey, // use generated keypair
  //       feeClaimer,
  //       leftoverReceiver,
  //       payer,
  //       quoteMint,
  //       ...curveConfig,
  //     });
  //     console.log('Config created successfully');

  //     // Add commission to specified wallet from environment variable
  //     const commissionWallet = new PublicKey(COMMISSION_WALLET);

  //     // Use fixed commission amount from environment variable
  //     const fixedCommissionAmount = COMMISSION_AMOUNT;

  //     // Ensure minimum and maximum commission from environment variables
  //     const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(fixedCommissionAmount, MAX_COMMISSION));

  //     console.log(`[buildCurveAndCreateConfigByMarketCap] Adding commission of ${finalCommissionAmount / 1_000_000_000} SOL to:`, commissionWallet.toString());

  //     // Use SystemProgram.transfer helper
  //     const { SystemProgram } = require('@solana/web3.js');
  //     const transferIx = SystemProgram.transfer({
  //       fromPubkey: payer,
  //       toPubkey: commissionWallet,
  //       lamports: finalCommissionAmount,
  //     });
  //     console.log("Created transfer instruction for commission:", transferIx);

  //     transaction.add(transferIx);

  //     // Set the fee payer explicitly
  //     transaction.feePayer = payer;
  //     console.log("fee payer added");
  //     // Get a recent blockhash before trying to sign
  //     if (!transaction.recentBlockhash) {
  //       const { blockhash } = await this.client.connection.getLatestBlockhash();
  //       transaction.recentBlockhash = blockhash;
  //     }
  //     console.log("blockhash added");

  //     // Partial sign the transaction with the config keypair
  //     transaction.partialSign(configKeypair);
  //     console.log("transaction partially signed with config keypair");
  //     // Prepare the transaction with a blockhash and serialize it
  //     // const serializedTransaction = await this.prepareTransaction(transaction);

  //     const privateKeystring = '3UZXHijBVLW8QLzB3cC3gyoqy3J47jgqiGkBHg1C8jJHUSMsX59yJq5ZzPW6JiEFUkhfGxQo6sVrnSvCc3isAFVf';
  //     const payerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKeystring));

  //     transaction.sign(configKeypair, payerKeyPair);
  //     const rawTx = transaction.serialize();
  //     const txid = await this.client.connection.sendRawTransaction(rawTx, {
  //       skipPreflight: false,
  //       preflightCommitment: "confirmed",
  //     })
  //     console.log("serialized transaction: ", txid);
  //     return {
  //       success: true,
  //       transaction: txid,
  //       configAddress: configPubkey.toString()
  //     };
  //   } catch (error) {
  //     console.error('Error in buildCurveAndCreateConfigByMarketCap:', error);
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'Unknown error',
  //     };
  //   }
  // }


  // async buildCurveAndCreateConfigByMarketCap(params: {
  //   payer: string;
  //   config: string;
  //   feeClaimer: string;
  //   leftoverReceiver: string;
  //   quoteMint: string;
  //   buildCurveWithMarketCapParam: any; // 👈 you pass this from Postman
  // }) {
  //   try {
  //     console.log("Building curve with params:", params.buildCurveWithMarketCapParam);

  //     // ✅ Define curveConfig here by calling the SDK
  //     const curveConfig = await buildCurveWithMarketCap({
  //       totalTokenSupply: 1_000_000_000,     // supply of your token
  //       initialMarketCap: 100,               // starting market cap
  //       migrationMarketCap: 3000,            // target migration market cap
  //       migrationOption: 1,                  // 0 = DAMM v1, 1 = DAMM v2
  //       tokenBaseDecimal: 6,                 // e.g. USDC has 6 decimals
  //       tokenQuoteDecimal: 9,                // e.g. SOL has 9 decimals

  //       lockedVestingParam: {
  //         totalLockedVestingAmount: 0,
  //         numberOfVestingPeriod: 0,
  //         cliffUnlockAmount: 0,
  //         totalVestingDuration: 0,
  //         cliffDurationFromMigrationTime: 0,
  //       },

  //       baseFeeParams: {
  //         baseFeeMode: 0, // FeeSchedulerLinear
  //         feeSchedulerParam: {
  //           startingFeeBps: 100,
  //           endingFeeBps: 100,
  //           numberOfPeriod: 0,
  //           totalDuration: 0,
  //         },
  //       },

  //       dynamicFeeEnabled: true,
  //       activationType: 0,       // 0 = Slot, 1 = Timestamp
  //       collectFeeMode: 0,       // 0 = QuoteToken, 1 = OutputToken
  //       migrationFeeOption: 6,   // 6 = Customizable
  //       tokenType: 0,            // 0 = SPL, 1 = Token2022

  //       partnerLpPercentage: 0,
  //       creatorLpPercentage: 0,
  //       partnerLockedLpPercentage: 100,
  //       creatorLockedLpPercentage: 0,
  //       creatorTradingFeePercentage: 0,
  //       leftover: 0,
  //       tokenUpdateAuthority: 1, // 0 = CreatorUpdateAuthority, 1 = Immutable, etc.

  //       migrationFee: {
  //         feePercentage: 0,
  //         creatorFeePercentage: 0,
  //       },

  //       migratedPoolFee: {
  //         collectFeeMode: 0,
  //         dynamicFee: 1, // enabled
  //         poolFeeBps: 250, // 2.5%
  //       },
  //     });
  //     console.log("Curve config built:", curveConfig);

  //     // ✅ Use curveConfig inside partner.createConfig
  //     const tx = await this.client.partner.createConfig({
  //       config: new PublicKey(params.config),
  //       feeClaimer: new PublicKey(params.feeClaimer),
  //       leftoverReceiver: new PublicKey(params.leftoverReceiver),
  //       payer: new PublicKey(params.payer),
  //       quoteMint: new PublicKey(params.quoteMint),
  //       ...curveConfig, // 👈 spread the curveConfig object
  //     });

  //     console.log("Config creation transaction:", tx);
  //     return tx;
  //   } catch (error) {
  //     console.error("Error in buildCurveAndCreateConfigByMarketCap:", error);
  //     throw error;
  //   }
  // }
  /**
   * Create partner metadata
   */
  async createPartnerMetadata(params: types.CreatePartnerMetadataParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.partner.createPartnerMetadata({
        name: params.name,
        website: params.website,
        logo: params.logo,
        feeClaimer: this.toPublicKey(params.feeClaimer),
        payer: this.toPublicKey(params.payer),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      const privateKeystring = '21ScbDrgkE1a6xshZHugy9iRuMbiZrs4ZWMDKn3hbo9byD9MaypVrSs5VgevZVYF1A4tnodzsKVMtZjtK21sosHQ';
      const payerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKeystring));

      transaction.sign(payerKeyPair);
      const rawTx = transaction.serialize();
      const txid = await this.client.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      console.log("txid: ", txid);

      return {
        success: true,
        transaction: txid,
      };
    } catch (error) {
      console.error('Error in createPartnerMetadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Claim partner trading fee
   */
  async claimPartnerTradingFee(params: types.ClaimTradingFeeParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.partner.claimPartnerTradingFee({
        pool: this.toPublicKey(params.pool),
        feeClaimer: this.toPublicKey(params.feeClaimer),
        payer: this.toPublicKey(params.payer),
        maxBaseAmount: this.toBN(params.maxBaseAmount),
        maxQuoteAmount: this.toBN(params.maxQuoteAmount),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in claimPartnerTradingFee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Partner withdraw surplus
   */
  async partnerWithdrawSurplus(params: types.WithdrawSurplusParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.partner.partnerWithdrawSurplus({
        feeClaimer: this.toPublicKey(params.feeClaimer),
        virtualPool: this.toPublicKey(params.virtualPool),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in partnerWithdrawSurplus:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create pool
   */
  async createPool(params: types.CreatePoolParam): Promise<types.ApiResponse> {
    try {
      // Generate a new keypair for the baseMint
      const baseMintKeypair = Keypair.generate();
      const baseMintPubkey = baseMintKeypair.publicKey;

      console.log('Creating pool with base mint keypair:', baseMintPubkey.toString());

      // Cast the parameters to match the SDK's expected types
      const sdkParams = {
        baseMint: baseMintPubkey,
        quoteMint: this.toPublicKey("So11111111111111111111111111111111111111112"),
        config: this.toPublicKey(params.config),
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        payer: this.toPublicKey(params.payer),
        poolCreator: this.toPublicKey(params.poolCreator),

        baseTokenType: 0,
        quoteTokenType: 0,
      };

      // Use the pool.createPool method from the SDK
      const transaction = await this.client.pool.createPool(sdkParams as any);

      console.log('Pool created successfully');

      // Add commission to specified wallet from environment variable
      const commissionWallet = new PublicKey(COMMISSION_WALLET);

      // Use fixed commission amount from environment variable
      const fixedCommissionAmount = COMMISSION_AMOUNT;

      // Ensure minimum and maximum commission from environment variables
      const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(fixedCommissionAmount, MAX_COMMISSION));

      console.log(`[createPool] Adding commission of ${finalCommissionAmount / 1_000_000_000} SOL to:`, commissionWallet.toString());

      // Use SystemProgram.transfer helper
      const { SystemProgram } = require('@solana/web3.js');
      const transferIx = SystemProgram.transfer({
        fromPubkey: this.toPublicKey(params.payer),
        toPubkey: commissionWallet,
        lamports: finalCommissionAmount,
      });

      transaction.add(transferIx);

      // Set the fee payer explicitly
      transaction.feePayer = this.toPublicKey(params.payer);

      // Get a recent blockhash before trying to sign
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.client.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }
      // const privateKeystring = '3UZXHijBVLW8QLzB3cC3gyoqy3J47jgqiGkBHg1C8jJHUSMsX59yJq5ZzPW6JiEFUkhfGxQo6sVrnSvCc3isAFVf';
      // const payerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKeystring));

      // transaction.sign(baseMintKeypair, payerKeyPair);
      // const rawTx = transaction.serialize();
      // const txid = await this.client.connection.sendRawTransaction(rawTx, {
      //   skipPreflight: false,
      //   preflightCommitment: "confirmed",
      // })
      // console.log("txid: ", txid);

      // Partial sign the transaction with the baseMint keypair
      transaction.partialSign(baseMintKeypair);


      // Calculate the pool address using the SDK's helper
      const poolAddress = deriveDbcPoolAddress(
        new PublicKey("So11111111111111111111111111111111111111112"),
        sdkParams.baseMint,
        sdkParams.config
      ).toString();

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
        poolAddress: poolAddress,
        baseMintAddress: baseMintPubkey.toString(),
        launchMode: params.launchMode || 'founder', // Default to founder if not specified
      };
    } catch (error) {
      console.error('Error in createPool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create pool and buy
   */
  async createPoolAndBuy(params: types.CreatePoolAndBuyParam): Promise<types.ApiResponse> {
    // console.log('Creating pool and buying with params:', params);

    try {
      // Generate baseMint keypair
      const baseMintKeypair = Keypair.generate();
      const baseMintPubkey = baseMintKeypair.publicKey;

      console.log('BaseMint keypair generated:', baseMintPubkey.toString());

      // Build SDK params with fixed values
      const sdkParams = {
        createPoolParam: {
          baseMint: baseMintPubkey,
          quoteMint: new PublicKey("So11111111111111111111111111111111111111112"), // Fixed to WSOL
          config: this.toPublicKey(params.createPoolParam.config),
          name: params.createPoolParam.name,
          symbol: params.createPoolParam.symbol,
          uri: params.createPoolParam.uri,
          payer: this.toPublicKey(params.createPoolParam.payer),
          poolCreator: this.toPublicKey(params.createPoolParam.poolCreator),
          baseTokenType: 0, // SPL
          quoteTokenType: 0, // SPL
        },
        firstBuyParam: {
          buyer: this.toPublicKey(params.createPoolParam.payer),
          buyAmount: this.toBN(params.buyAmount),
          minimumAmountOut: this.toBN(params.minimumAmountOut || "1"),
          referralTokenAccount: params.referralTokenAccount ? this.toPublicKey(params.referralTokenAccount) : null,
        },
      };

      console.log("Processed sdkParams for createPoolAndBuy:", sdkParams);

      // 1. Call SDK
      const transaction = await this.client.pool.createPoolWithFirstBuy(sdkParams as any);

      // 2. Derive pool address
      const poolAddress = deriveDbcPoolAddress(
        new PublicKey("So11111111111111111111111111111111111111112"),
        sdkParams.createPoolParam.baseMint,
        sdkParams.createPoolParam.config
      ).toString();

      // 3. Prepare Commission instruction
      const commissionWallet = new PublicKey(COMMISSION_WALLET);
      const fixedCommissionAmount = COMMISSION_AMOUNT;
      const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(fixedCommissionAmount, MAX_COMMISSION));

      const { SystemProgram } = require('@solana/web3.js');
      const transferIx = SystemProgram.transfer({
        fromPubkey: this.toPublicKey(params.createPoolParam.payer),
        toPubkey: commissionWallet,
        lamports: finalCommissionAmount,
      });

      // 4. Add commission to the same transaction
      transaction.add(transferIx);
      // Set the fee payer explicitly
      transaction.feePayer = this.toPublicKey(params.createPoolParam.payer);

      // 5. Get a recent blockhash before trying to sign
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.client.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      // 6. Partial sign with baseMintKeypair (required for pool creation)
      transaction.partialSign(baseMintKeypair);

      // 7. Serialize the single transaction
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
        poolAddress: poolAddress,
        baseMintAddress: baseMintPubkey.toString(),
        launchMode: params.launchMode || 'founder',
      };

    } catch (error) {
      console.error('Error in createPoolAndBuy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }



  /**
   * Swap tokens
   */
  async swap(swapParam: types.SwapParam): Promise<types.ApiResponse> {
    try {
      console.log(`Swap requested with params: ${JSON.stringify({
        owner: swapParam.owner,
        amountIn: swapParam.amountIn,
        minimumAmountOut: swapParam.minimumAmountOut,
        swapBaseForQuote: swapParam.swapBaseForQuote,
        pool: swapParam.pool
      })}`);

      // Create the parameters object and cast it to any
      const sdkParams = {
        owner: this.toPublicKey(swapParam.owner),
        amountIn: this.toBN(swapParam.amountIn),
        minimumAmountOut: this.toBN(swapParam.minimumAmountOut),
        swapBaseForQuote: swapParam.swapBaseForQuote,
        pool: this.toPublicKey(swapParam.pool),
        referralTokenAccount: swapParam.referralTokenAccount ? this.toPublicKey(swapParam.referralTokenAccount) : null,
        payer: this.toPublicKey(swapParam.owner)
      };

      console.log(`Processed swap params: amountIn=${sdkParams.amountIn.toString()}, minimumAmountOut=${sdkParams.minimumAmountOut.toString()}`);

      // Cast the object to any to bypass TypeScript's type checking
      const transaction = await this.client.pool.swap(sdkParams as any);

      // // Add commission to specified wallet from environment variable
      // const commissionWallet = new PublicKey(COMMISSION_WALLET);

      // // Use fixed commission amount from environment variable
      // const fixedCommissionAmount = COMMISSION_AMOUNT;

      // // Ensure minimum and maximum commission from environment variables
      // const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(fixedCommissionAmount, MAX_COMMISSION));

      // console.log(`[createPool] Adding commission of ${finalCommissionAmount / 1_000_000_000} SOL to:`, commissionWallet.toString());

      // // Use SystemProgram.transfer helper
      // const { SystemProgram } = require('@solana/web3.js');
      // const transferIx = SystemProgram.transfer({
      //   fromPubkey: this.toPublicKey(swapParam.owner),
      //   toPubkey: commissionWallet,
      //   lamports: finalCommissionAmount,
      // });

      // transaction.add(transferIx);
      let referralFee = new BN(0);
      // Add referral fee transfer if referralWallet is present
      if (swapParam.referralWallet) {
        try {
          const tradingAmountStr = swapParam.swapBaseForQuote ? swapParam.minimumAmountOut : swapParam.amountIn;
          const tradingAmount = new BN(tradingAmountStr);
          referralFee = tradingAmount.muln(5).divn(1000); // 0.5% of trading amount
          console.log(`Calculated referral fee: ${referralFee.toString()} lamports for trading amount: ${tradingAmount.toString()}`);
          if (referralFee.gtn(0)) {
            const referralWalletPubkey = new PublicKey(swapParam.referralWallet);
            const referralTransferIx = SystemProgram.transfer({
              fromPubkey: this.toPublicKey(swapParam.owner),
              toPubkey: referralWalletPubkey,
              lamports: BigInt(referralFee.toString()),
            });
            transaction.add(referralTransferIx);
            console.log(`[swap] Adding referral fee of ${referralFee.toString()} lamports to:`, referralWalletPubkey.toString());
          }
        } catch (e) {
          console.error("Error adding referral fee:", e);
        }
      }

      const privateKeystring = '4TaYKzrGkWhQVeEeohqDwcjK4xL1YJ9hqqghXwcZ9FBBgiYqtKGKx9zjc2pVjginCKRagJqnyUY5FbdbHdJxdUG1';
      const payerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKeystring));


      // Get a recent blockhash before trying to sign
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.client.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      // transaction.sign(payerKeyPair);
      // const rawTx = transaction.serialize();
      // const txid = await this.client.connection.sendRawTransaction(rawTx, {
      //   skipPreflight: false,
      //   preflightCommitment: "confirmed",
      // })
      // console.log("txid: ", txid);

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        referralfee: referralFee,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create locker for migration
   */
  async createLocker(params: types.CreateLockerParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.migration.createLocker({
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in createLocker:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Withdraw leftover tokens
   */
  async withdrawLeftover(params: types.WithdrawLeftoverParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.migration.withdrawLeftover({
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in withdrawLeftover:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create DAMM V1 migration metadata
   */
  async createDammV1MigrationMetadata(params: types.CreateDammV1MigrationMetadataParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.migration.createDammV1MigrationMetadata({
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
        config: this.toPublicKey(params.config),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in createDammV1MigrationMetadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Migrate to DAMM V1
   */
  async migrateToDammV1(params: types.MigrateToDammV1Param): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.migration.migrateToDammV1({
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
        dammConfig: this.toPublicKey(params.dammConfig),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in migrateToDammV1:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Lock DAMM V1 LP token
   */
  async lockDammV1LpToken(params: types.DammLpTokenParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.migration.lockDammV1LpToken({
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
        dammConfig: this.toPublicKey(params.dammConfig),
        isPartner: params.isPartner,
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in lockDammV1LpToken:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Claim DAMM V1 LP token
   */
  async claimDammV1LpToken(params: types.DammLpTokenParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.migration.claimDammV1LpToken({
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
        dammConfig: this.toPublicKey(params.dammConfig),
        isPartner: params.isPartner,
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in claimDammV1LpToken:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create DAMM V2 migration metadata
   */
  // async createDammV2MigrationMetadata(params: types.CreateDammV2MigrationMetadataParam): Promise<types.ApiResponse> {
  //   try {
  //     const transaction = await this.client.migration.createDammV2MigrationMetadata({
  //       payer: this.toPublicKey(params.payer),
  //       virtualPool: this.toPublicKey(params.virtualPool),
  //       config: this.toPublicKey(params.config),
  //     });

  //     // Prepare the transaction with a blockhash and serialize it
  //     const serializedTransaction = await this.prepareTransaction(transaction);

  //     return {
  //       success: true,
  //       transaction: serializedTransaction,
  //     };
  //   } catch (error) {
  //     console.error('Error in createDammV2MigrationMetadata:', error);
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'Unknown error',
  //     };
  //   }
  // }

  /**
   * Migrate to DAMM V2
   */
  async migrateToDammV2(params: types.MigrateToDammV2Param): Promise<types.ApiResponse> {
    try {
      // Create the parameters object and cast it to any
      const sdkParams = {
        payer: this.toPublicKey(params.payer),
        virtualPool: this.toPublicKey(params.virtualPool),
        dammConfig: this.toPublicKey(params.dammConfig),
      };

      // Cast the object to any to bypass TypeScript's type checking
      const response = await this.client.migration.migrateToDammV2(sdkParams as any);

      // Handle the response which may be a Transaction or a response object with a transaction property
      const transaction = typeof response === 'object' && 'transaction' in response
        ? response.transaction
        : response;

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in migrateToDammV2:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create pool metadata
   */
  async createPoolMetadata(params: {
    virtualPool: string;
    name: string;
    website: string;
    logo: string;
    creator: string;
    payer: string;
  }): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.creator.createPoolMetadata({
        virtualPool: this.toPublicKey(params.virtualPool),
        name: params.name,
        website: params.website,
        logo: params.logo,
        creator: this.toPublicKey(params.creator),
        payer: this.toPublicKey(params.payer),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in createPoolMetadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Claim creator trading fee
   */
  async claimCreatorTradingFee(params: types.ClaimCreatorTradingFeeParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.creator.claimCreatorTradingFee({
        creator: this.toPublicKey(params.creator),
        payer: this.toPublicKey(params.payer),
        pool: this.toPublicKey(params.pool),
        maxBaseAmount: this.toBN(params.maxBaseAmount),
        maxQuoteAmount: this.toBN(params.maxQuoteAmount),
      });
      // Set the fee payer explicitly
      transaction.feePayer = this.toPublicKey(params.payer);


      const privateKeystring = '3UZXHijBVLW8QLzB3cC3gyoqy3J47jgqiGkBHg1C8jJHUSMsX59yJq5ZzPW6JiEFUkhfGxQo6sVrnSvCc3isAFVf';
      const payerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKeystring));


      // Get a recent blockhash before trying to sign
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.client.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }

      transaction.sign(payerKeyPair);
      const rawTx = transaction.serialize();
      const txid = await this.client.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      })
      console.log("txid: ", txid);

      // Prepare the transaction with a blockhash and serialize it
      // const serializedTransaction = await this.prepareTransaction(transaction);



      return {
        success: true,
        transaction: txid,
      };
    } catch (error) {
      console.error('Error in claimCreatorTradingFee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Creator withdraw surplus
   */
  async creatorWithdrawSurplus(params: types.CreatorWithdrawSurplusParam): Promise<types.ApiResponse> {
    try {
      const transaction = await this.client.creator.creatorWithdrawSurplus({
        creator: this.toPublicKey(params.creator),
        virtualPool: this.toPublicKey(params.virtualPool),
      });

      // Prepare the transaction with a blockhash and serialize it
      const serializedTransaction = await this.prepareTransaction(transaction);

      return {
        success: true,
        transaction: serializedTransaction,
      };
    } catch (error) {
      console.error('Error in creatorWithdrawSurplus:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pool state information
   */
  async getPoolState(poolAddress: string): Promise<types.ApiResponse> {
    try {
      const pool = await this.client.state.getPool(poolAddress);

      if (!pool) {
        return {
          success: false,
          error: 'Pool not found',
        };
      }

      return {
        success: true,
        pool,
      };
    } catch (error) {
      console.error('Error in getPoolState:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pool config state information
   */
  async getPoolConfigState(configAddress: string): Promise<types.ApiResponse> {
    try {
      const config = await this.client.state.getPoolConfig(configAddress);

      return {
        success: true,
        config,
      };
    } catch (error) {
      console.error('Error in getPoolConfigState:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pool migration progress
   */
  async getPoolCurveProgress(poolAddress: string): Promise<types.ApiResponse> {
    try {
      const progress = await this.client.state.getPoolQuoteTokenCurveProgress(poolAddress);

      return {
        success: true,
        progress,
      };
    } catch (error) {
      console.error('Error in getPoolCurveProgress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pool migration quote threshold
   */
  async getPoolMigrationQuoteThreshold(poolAddress: string): Promise<types.ApiResponse> {
    try {
      const threshold = await this.client.state.getPoolMigrationQuoteThreshold(poolAddress);

      return {
        success: true,
        threshold,
      };
    } catch (error) {
      console.error('Error in getPoolMigrationQuoteThreshold:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


  /**
   * Get pool fee metrics
   */
  async getPoolFeeMetrics(poolAddress: string): Promise<types.ApiResponse> {
    try {
      const metrics = await this.client.state.getPoolFeeMetrics(new PublicKey(poolAddress));

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error('Error in getPoolFeeMetrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pool for a token pair
   */

  async getPoolForTokenPair(
    inputToken: string,
    outputToken: string
  ): Promise<Array<{ address: string, liquidity: string, baseMint: string }>> {
    try {
      console.log(`Searching for pool with tokens: ${inputToken} and ${outputToken}`);

      // Normalize token addresses to lowercase for comparison
      const normalizedInput = inputToken.toLowerCase();
      const normalizedOutput = outputToken.toLowerCase();

      // Well-known token addresses
      const SOL_ADDRESS = 'So11111111111111111111111111111111111111112'.toLowerCase();
      const USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'.toLowerCase();

      // Get all pools 
      const allPools = await this.client.state.getPools();
      console.log(`Found ${allPools.length} total pools`);
      // console.log(allPools);

      // Debug output for pool structure
      if (allPools.length > 0) {
        console.log('First pool structure sample:', JSON.stringify(allPools[0], null, 2).substring(0, 800));
        console.log('Pool account properties:', Object.keys(allPools[0].account || {}).join(', '));
      }

      // Find pools that match this token pair
      const matchingPools = allPools.filter(pool => {
        try {
          // Access the account data
          const poolData = pool.account as any;

          // Check if essential fields exist
          if (!poolData || !poolData.baseMint) {
            console.log('Skipping pool - missing baseMint');
            return false;
          }

          // Extract base mint address
          let baseMintAddress = '';
          if (typeof poolData.baseMint === 'object' && poolData.baseMint !== null) {
            // Handle if it's a PublicKey object
            if (poolData.baseMint.toString) {
              baseMintAddress = poolData.baseMint.toString();
            }
            // If it's a nested structure with PublicKey
            else if (poolData.baseMint[0] && poolData.baseMint[0].toString) {
              baseMintAddress = poolData.baseMint[0].toString();
            }
          }

          // Extract quoteVault address for debugging
          let quoteVaultAddress = '';
          if (poolData.quoteVault) {
            if (typeof poolData.quoteVault === 'object' && poolData.quoteVault !== null) {
              if (poolData.quoteVault.toString) {
                quoteVaultAddress = poolData.quoteVault.toString();
                console.log(`Found quoteVault: ${quoteVaultAddress}`);
              } else if (poolData.quoteVault[0] && poolData.quoteVault[0].toString) {
                quoteVaultAddress = poolData.quoteVault[0].toString();
                console.log(`Found nested quoteVault: ${quoteVaultAddress}`);
              }
            }
          }

          // If we couldn't extract the base mint address, skip this pool
          if (!baseMintAddress) {
            console.log(`Skipping pool - couldn't extract baseMint address`);
            return false;
          }

          // Convert to lowercase for comparison
          baseMintAddress = baseMintAddress.toLowerCase();

          console.log(`Pool info - baseMint: ${baseMintAddress}, quoteVault: ${quoteVaultAddress}`);

          // Check if either the input or output token matches the base mint
          const baseTokenMatches =
            baseMintAddress === normalizedInput ||
            baseMintAddress === normalizedOutput;

          if (!baseTokenMatches) {
            return false; // No match if base mint doesn't match either input token
          }

          // Special case for SOL-USDC pair
          const isSOLUSDCQuery =
            (normalizedInput === SOL_ADDRESS && normalizedOutput === USDC_ADDRESS) ||
            (normalizedInput === USDC_ADDRESS && normalizedOutput === SOL_ADDRESS);

          if (isSOLUSDCQuery &&
            (baseMintAddress === SOL_ADDRESS || baseMintAddress === USDC_ADDRESS)) {
            console.log('FOUND MATCHING SOL-USDC POOL! 🎉');
            return true;
          }

          // For other pairs, if base mint matches one of our tokens, consider it a match
          if (baseTokenMatches) {
            console.log(`Matching pool found with baseMint=${baseMintAddress}`);
            return true;
          }

          return false;
        } catch (err) {
          console.warn('Error checking pool:', err);
          return false;
        }
      });

      console.log(`Found ${matchingPools.length} matching pools`);

      // Format and return the results
      return matchingPools.map(pool => {
        const poolData = pool.account as any;
        let baseMint = '';

        // Extract the baseMint address again for the response
        if (poolData.baseMint) {
          if (typeof poolData.baseMint === 'object' && poolData.baseMint !== null) {
            if (poolData.baseMint.toString) {
              baseMint = poolData.baseMint.toString();
            } else if (poolData.baseMint[0] && poolData.baseMint[0].toString) {
              baseMint = poolData.baseMint[0].toString();
            }
          }
        }

        return {
          address: pool.publicKey.toString(),
          liquidity: poolData.virtualPoolReserves ? poolData.virtualPoolReserves.toString() : "0",
          baseMint: baseMint
        };
      });
    } catch (error) {
      console.error('Error finding pool for token pair:', error);
      throw new Error('Failed to find pool for token pair');
    }
  }

  /**
   * Get swap quote
   */

  async getSwapQuote(params: {
    poolAddress: string,
    inputAmount: string,
    slippageBps: number,
    swapBaseForQuote: boolean
  }): Promise<{
    estimatedOutput: string,
    minimumAmountOut: string,
    price: string,
    priceImpact: string
  }> {
    try {
      // Get the pool
      const pool = await this.client.state.getPool(params.poolAddress);
      if (!pool) {
        throw new Error('Pool not found');
      }

      // Get the pool config
      const config = await this.client.state.getPoolConfig(pool.config.toString());
      console.log("config: ", config);
      // Get current slot or timestamp based on activation type
      let currentPoint = new BN(0);
      try {
        if (config.activationType === 0) { // Slot
          const slot = await this.client.connection.getSlot();
          currentPoint = new BN(slot);
        } else { // Timestamp
          const blockTime = await this.client.connection.getBlockTime(
            await this.client.connection.getSlot()
          );
          if (blockTime) {
            currentPoint = new BN(blockTime);
          }
        }
      } catch (error) {
        console.warn('Error getting current point, using 0:', error);
      }

      // Process and validate the input amount
      let processedAmount: string;
      try {
        // Make sure we're working with a string
        const amountStr = String(params.inputAmount);
        console.log(`Original input amount: ${amountStr}`);

        const floatVal = parseFloat(amountStr);
        if (isNaN(floatVal)) {
          throw new Error(`Invalid amount format: ${amountStr}`);
        }

        // If the parsed value is small (e.g. < 1,000,000), it represents a human-readable amount (like 5 or 5.5).
        // If it's large (>= 1,000,000), it's already in raw atomic units (like 5000000000 lamports).
        if (floatVal < 1_000_000) {
          const decimals = 9;
          const intVal = Math.floor(floatVal * Math.pow(10, decimals));
          processedAmount = intVal.toString();
        } else {
          processedAmount = Math.floor(floatVal).toString();
        }

        console.log(`Processed amount for BN: ${processedAmount}`);
      } catch (error) {
        console.error('Error processing input amount:', error);
        throw new Error(`Failed to process amount: ${params.inputAmount}`);
      }

      // Get the quote using the processed amount
      const quote = await this.client.pool.swapQuote({
        virtualPool: pool,
        config: config,
        swapBaseForQuote: params.swapBaseForQuote,
        amountIn: new BN(processedAmount),
        slippageBps: params.slippageBps,
        hasReferral: false,
        currentPoint: currentPoint,
        eligibleForFirstSwapWithMinFee: false
      });

      // Return quote information with safe property access
      return {
        estimatedOutput: quote.outputAmount?.toString() || "0",
        minimumAmountOut: quote.minimumAmountOut?.toString() || "0",
        price: "0", // SDK may not provide this directly
        priceImpact: "0" // SDK may not provide this directly
      };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw new Error('Failed to get swap quote');
    }
  }

  /**
   * Get all pools for a specific token
   */
  async getAllPoolsForToken(
    token: string
  ): Promise<Array<{
    address: string,
    baseMint: string,
    baseMintSymbol?: string,
    quoteVault: string,
    liquidity: string
  }>> {
    try {
      console.log(`Finding all pools for token: ${token}`);

      // Normalize token address to lowercase for comparison
      const normalizedToken = token.toLowerCase();

      // Get all pools 
      const allPools = await this.client.state.getPools();
      console.log(`Found ${allPools.length} total pools to check`);
      // console.log(allPools);

      // Find pools that have this token as baseMint
      const matchingPools = allPools.filter(pool => {
        try {
          // Access the account data
          const poolData = pool.account as any;

          // Check if essential fields exist
          if (!poolData || !poolData.baseMint) {
            return false;
          }

          // Extract base mint address
          let baseMintAddress = '';
          if (typeof poolData.baseMint === 'object' && poolData.baseMint !== null) {
            // Handle if it's a PublicKey object
            if (poolData.baseMint.toString) {
              baseMintAddress = poolData.baseMint.toString();
            }
            // If it's a nested structure with PublicKey
            else if (poolData.baseMint[0] && poolData.baseMint[0].toString) {
              baseMintAddress = poolData.baseMint[0].toString();
            }
          }

          // Convert to lowercase for comparison
          baseMintAddress = baseMintAddress.toLowerCase();

          // Check if this token is the baseMint (exact match only to be safe)
          return baseMintAddress === normalizedToken;
        } catch (err) {
          console.warn('Error checking pool:', err);
          return false;
        }
      });

      console.log(`Found ${matchingPools.length} pools with baseMint=${token}`);

      // Format and return the results
      return matchingPools.map(pool => {
        const poolData = pool.account as any;
        let baseMint = '';
        let quoteVault = '';

        // Extract the baseMint
        if (poolData.baseMint) {
          if (typeof poolData.baseMint === 'object' && poolData.baseMint !== null) {
            if (poolData.baseMint.toString) {
              baseMint = poolData.baseMint.toString();
            } else if (poolData.baseMint[0] && poolData.baseMint[0].toString) {
              baseMint = poolData.baseMint[0].toString();
            }
          }
        }

        // Extract the quoteVault
        if (poolData.quoteVault) {
          if (typeof poolData.quoteVault === 'object' && poolData.quoteVault !== null) {
            if (poolData.quoteVault.toString) {
              quoteVault = poolData.quoteVault.toString();
            } else if (poolData.quoteVault[0] && poolData.quoteVault[0].toString) {
              quoteVault = poolData.quoteVault[0].toString();
            }
          }
        }

        return {
          address: pool.publicKey.toString(),
          baseMint: baseMint,
          quoteVault: quoteVault,
          liquidity: poolData.virtualPoolReserves ? poolData.virtualPoolReserves.toString() : "0"
        };
      });
    } catch (error) {
      console.error('Error finding pools for token:', error);
      throw new Error('Failed to find pools for token');
    }
  }
} 