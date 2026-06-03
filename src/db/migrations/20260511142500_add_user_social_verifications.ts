import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("user_social_verifications", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.string("platform").notNullable(); // 'twitter' or 'tiktok'
    table.string("handle").notNullable();
    table.string("account_id").notNullable();
    table.timestamp("verified_at").defaultTo(knex.fn.now());
    table.unique(["user_id", "platform"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("user_social_verifications");
}
