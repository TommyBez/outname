ALTER TABLE "waitlist_entries" ADD COLUMN "primary_interest" text;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "profile_type" text;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "utm_content" text;--> statement-breakpoint
CREATE INDEX "waitlist_entries_primary_interest_created_idx" ON "waitlist_entries" USING btree ("primary_interest","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "waitlist_entries_profile_type_created_idx" ON "waitlist_entries" USING btree ("profile_type","created_at" DESC NULLS LAST);
