-- Profiles table
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
--
-- Stores a public display name and optional avatar for each user.
-- Referenced by leaderboards, check-ins, and group runs.
-- Canonical source for Profiles schema, defaults, triggers, and RLS policies.

CREATE TABLE IF NOT EXISTS "Profiles" (
    "UserId"      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "DisplayName" TEXT        NOT NULL,
    "AvatarUrl"   TEXT,
    "CreatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.apply_profiles_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."DisplayName" IS NULL OR BTRIM(NEW."DisplayName") = '' THEN
        NEW."DisplayName" = 'Runner-' || LEFT(REPLACE(NEW."UserId"::text, '-', ''), 6);
    END IF;

    IF TG_OP = 'UPDATE' OR NEW."UpdatedAt" IS NULL THEN
        NEW."UpdatedAt" = NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON "Profiles";
DROP TRIGGER IF EXISTS profiles_apply_defaults ON "Profiles";

CREATE TRIGGER profiles_apply_defaults
    BEFORE INSERT OR UPDATE ON "Profiles"
    FOR EACH ROW
    EXECUTE FUNCTION public.apply_profiles_defaults();

ALTER TABLE "Profiles" ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous) can read profiles for leaderboards / check-in display
CREATE POLICY "Profiles are publicly readable"
    ON "Profiles" FOR SELECT
    USING (true);

-- Authenticated users can only insert their own profile row
CREATE POLICY "Users can insert own profile"
    ON "Profiles" FOR INSERT
    WITH CHECK (auth.uid() = "UserId");

-- Authenticated users can only update their own profile row
CREATE POLICY "Users can update own profile"
    ON "Profiles" FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (auth.uid() = "UserId");

-- Authenticated users can delete their own profile row
CREATE POLICY "Users can delete own profile"
    ON "Profiles" FOR DELETE
    USING (auth.uid() = "UserId");
