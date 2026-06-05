DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'account'
      AND column_name = 'userId'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'account'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "account" RENAME COLUMN "userId" TO "user_id";
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_userId_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_user_id_user_id_fk'
  ) THEN
    ALTER TABLE "account"
      RENAME CONSTRAINT "account_userId_user_id_fk" TO "account_user_id_user_id_fk";
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session'
      AND column_name = 'userId'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "session" RENAME COLUMN "userId" TO "user_id";
  END IF;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_userId_user_id_fk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_user_id_user_id_fk'
  ) THEN
    ALTER TABLE "session"
      RENAME CONSTRAINT "session_userId_user_id_fk" TO "session_user_id_user_id_fk";
  END IF;
END
$$;