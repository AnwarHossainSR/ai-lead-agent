CREATE TYPE "public"."dependency_health_status" AS ENUM('up', 'degraded', 'down');--> statement-breakpoint
CREATE TABLE "dependency_health_samples" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dependency" text NOT NULL,
	"status" "dependency_health_status" NOT NULL,
	"latency_ms" integer,
	"failure_reason" text,
	"sampled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dependency_health_samples_latency_pairs_with_answer" CHECK (("dependency_health_samples"."status" = 'down') = ("dependency_health_samples"."latency_ms" IS NULL)),
	CONSTRAINT "dependency_health_samples_failure_has_reason" CHECK (("dependency_health_samples"."status" = 'up') = ("dependency_health_samples"."failure_reason" IS NULL))
);
--> statement-breakpoint
CREATE INDEX "dependency_health_samples_dependency_sampled_idx" ON "dependency_health_samples" USING btree ("dependency","sampled_at");