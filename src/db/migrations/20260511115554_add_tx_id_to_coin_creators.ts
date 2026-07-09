import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("coin_creators", (table) => {
        table.string("tx_id").unique().nullable().index();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("coin_creators", (table) => {
        table.dropColumn("tx_id");
    });
}
