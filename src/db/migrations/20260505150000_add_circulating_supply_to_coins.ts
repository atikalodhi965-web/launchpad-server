import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("coins", (table) => {
        table.decimal("circulating_supply", 40, 10).defaultTo(0);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("coins", (table) => {
        table.dropColumn("circulating_supply");
    });
}
