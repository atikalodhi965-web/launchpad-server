import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("coin_charts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE").index();
    table.string("timeframe").notNullable().index(); // e.g., '1m', '5m', '15m', '1h', '4h', '1d'
    table.timestamp("period_start").notNullable().index();
    
    table.decimal("open", 30, 10).notNullable();
    table.decimal("high", 30, 10).notNullable();
    table.decimal("low", 30, 10).notNullable();
    table.decimal("close", 30, 10).notNullable();
    table.decimal("volume", 30, 10).defaultTo(0);
    
    table.timestamps(true, true);

    // Unique constraint so we can upsert easily
    table.unique(["coin_id", "timeframe", "period_start"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("coin_charts");
}
