-- Profiles table
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
--
-- Stores a public display name and optional avatar for each user.
-- Referenced by leaderboards, check-ins, and group runs.

CREATE TABLE IF NOT EXISTS "Profiles" (
    "UserId"      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "DisplayName" TEXT        NOT NULL,
    "AvatarUrl"   TEXT,
    "CreatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON "Profiles";

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON "Profiles"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_profiles_updated_at();

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
