import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("coins", (table) => {
        table.decimal("volume_1m", 30, 2).defaultTo(0);
        table.decimal("volume_5m", 30, 2).defaultTo(0);
        table.decimal("volume_6h", 30, 2).defaultTo(0);
        table.decimal("liquidity", 30, 2).defaultTo(0);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("coins", (table) => {
        table.dropColumn("volume_1m");
        table.dropColumn("volume_5m");
        table.dropColumn("volume_6h");
        table.dropColumn("liquidity");
    });
}
