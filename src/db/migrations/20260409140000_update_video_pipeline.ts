import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add pipeline related columns to coin_videos
  await knex.schema.alterTable("coin_videos", (table) => {
    table.enu("status", ["pending", "processing", "moderating", "approved", "rejected"], {
      useNative: true,
      enumName: "video_status_enum",
    }).defaultTo("pending").index();

    table.string("cloudflare_stream_id").index();
    table.string("r2_key").index();
    table.string("mux_asset_id");
    table.string("mux_playback_id");
    table.text("moderation_reason");
    table.jsonb("moderation_metadata");
    table.boolean("is_approved").defaultTo(false).index();
    table.timestamp("processing_started_at");
    table.timestamp("processing_completed_at");
  });

  // Also check if we need to rename any columns to match the existing code's expectations if any
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("coin_videos", (table) => {
    table.dropColumn("status");
    table.dropColumn("cloudflare_stream_id");
    table.dropColumn("r2_key");
    table.dropColumn("mux_asset_id");
    table.dropColumn("mux_playback_id");
    table.dropColumn("moderation_reason");
    table.dropColumn("moderation_metadata");
    table.dropColumn("is_approved");
    table.dropColumn("processing_started_at");
    table.dropColumn("processing_completed_at");
  });
  await knex.raw("DROP TYPE IF EXISTS video_status_enum");
}
