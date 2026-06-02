ALTER TABLE "waitlist_entries"
  ADD COLUMN "provisioned_user_id" text;

ALTER TABLE "waitlist_entries"
  ADD COLUMN "provisioned_at" timestamp with time zone;

ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_provisioned_user_id_user_id_fk"
  FOREIGN KEY ("provisioned_user_id")
  REFERENCES "public"."user"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
