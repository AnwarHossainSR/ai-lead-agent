CREATE TYPE "public"."ai_invocation_outcome" AS ENUM('succeeded', 'invalid_output', 'provider_error', 'refused_by_ceiling');--> statement-breakpoint
CREATE TABLE "ai_invocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"prompt_name" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"model" text NOT NULL,
	"tier" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"estimated_cost_usd" numeric(10, 6) NOT NULL,
	"latency_ms" integer NOT NULL,
	"attempts" integer NOT NULL,
	"outcome" "ai_invocation_outcome" NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_invocations_input_tokens_non_negative" CHECK ("ai_invocations"."input_tokens" >= 0),
	CONSTRAINT "ai_invocations_output_tokens_non_negative" CHECK ("ai_invocations"."output_tokens" >= 0),
	CONSTRAINT "ai_invocations_estimated_cost_non_negative" CHECK ("ai_invocations"."estimated_cost_usd" >= 0),
	CONSTRAINT "ai_invocations_latency_non_negative" CHECK ("ai_invocations"."latency_ms" >= 0),
	CONSTRAINT "ai_invocations_attempts_positive" CHECK ("ai_invocations"."attempts" >= 1)
);
--> statement-breakpoint
CREATE INDEX "ai_invocations_created_at_idx" ON "ai_invocations" USING btree ("created_at");