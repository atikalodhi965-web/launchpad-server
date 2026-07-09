import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add referral fields to users table
  await knex.schema.alterTable("users", (table) => {
    table.string("referral_code").unique().index();
    table.string("referred_by_code").index();
    table.timestamp("referral_accepted_at").nullable();
  });

  // Create referrals table
  await knex.schema.createTable("referrals", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("referrer_id").references("id").inTable("users").onDelete("CASCADE");
    table.uuid("referee_id").references("id").inTable("users").onDelete("CASCADE");

    table.string("referral_code").notNullable();

    table
      .enu("status", ["PENDING", "COMPLETED", "REWARDED"], {
        useNative: true,
        enumName: "referral_status_enum",
      })
      .defaultTo("PENDING");

    table.decimal("reward_usd", 18, 2).defaultTo(0);

    table.timestamp("completed_at").nullable();
    table.timestamp("rewarded_at").nullable();

    table.timestamps(true, true);

    table.unique(["referrer_id", "referee_id"]);
  });

  // Create referral_earnings table for trade commissions
  await knex.schema.createTable("referral_earnings", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("referrer_id").references("id").inTable("users").onDelete("CASCADE");
    table.uuid("referee_id").references("id").inTable("users").onDelete("CASCADE");
    table.uuid("trade_id").references("id").inTable("trades").onDelete("CASCADE");
    
    table.decimal("amount_usd", 18, 2).notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("referral_earnings");
  await knex.schema.dropTableIfExists("referrals");
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("referral_code");
    table.dropColumn("referred_by_code");
    table.dropColumn("referral_accepted_at");
  });
  await knex.raw("DROP TYPE IF EXISTS referral_status_enum");
}
