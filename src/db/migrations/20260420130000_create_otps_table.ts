import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("otps", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("identifier").notNullable().index(); // email or phone number
    table.string("code").notNullable();
    table.timestamp("expires_at").notNullable();
    table.boolean("verified").defaultTo(false);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("users", (table) => {
    table.string("phone_number").unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("otps");
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("phone_number");
  });
}
