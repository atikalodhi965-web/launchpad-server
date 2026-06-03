import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coins", (table) => {
    table.string("pool_address").unique();
    table.string("config_address");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coins", (table) => {
    table.dropColumn("pool_address");
    table.dropColumn("config_address");
  });
}
