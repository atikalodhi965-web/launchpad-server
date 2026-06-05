import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("user_coins", (table) => {
    table.decimal("realized_pnl", 30, 10).defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("user_coins", (table) => {
    table.dropColumn("realized_pnl");
  });
}
