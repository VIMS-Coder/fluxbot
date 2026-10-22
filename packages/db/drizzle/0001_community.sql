CREATE TABLE "giveaway_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giveaway_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"prize" text NOT NULL,
	"emoji" text DEFAULT '🎉' NOT NULL,
	"winners_count" integer DEFAULT 1 NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "temp_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temp_voices_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "tickets_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_voices" ADD CONSTRAINT "temp_voices_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "giveaway_entries_unique_idx" ON "giveaway_entries" USING btree ("giveaway_id","user_id");--> statement-breakpoint
CREATE INDEX "giveaway_entries_giveaway_idx" ON "giveaway_entries" USING btree ("giveaway_id");--> statement-breakpoint
CREATE INDEX "giveaways_guild_status_idx" ON "giveaways" USING btree ("guild_id","status","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "giveaways_message_idx" ON "giveaways" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "temp_voices_guild_idx" ON "temp_voices" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "tickets_guild_status_idx" ON "tickets" USING btree ("guild_id","status");