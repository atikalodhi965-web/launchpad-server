import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coins", (table) => {
    table.string("tiktok_url");
    table.string("youtube_url");
    table.boolean("twitter_verified").defaultTo(false);
    table.boolean("tiktok_verified").defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coins", (table) => {
    table.dropColumn("tiktok_url");
    table.dropColumn("youtube_url");
    table.dropColumn("twitter_verified");
    table.dropColumn("tiktok_verified");
  });
}
