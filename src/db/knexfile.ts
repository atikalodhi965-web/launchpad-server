import * as path from "path";
import type { Knex } from "knex";
require("dotenv").config();

// console.log("supabase connection string: ", process.env.DATABASE_URL);
const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lglvswwhsmfadqkdvuzf:vQYui7cvK.waXty@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: path.resolve(__dirname, "migrations"),
      extension: "ts",
    },
    pool: { min: 2, max: 10 },
  },

  production: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lglvswwhsmfadqkdvuzf:vQYui7cvK.waXty@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres', // SAME SUPABASE URL
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: path.resolve(__dirname, "migrations"),
      extension: "ts",
    },
    pool: { min: 2, max: 10 },
  },
};

export default config;
