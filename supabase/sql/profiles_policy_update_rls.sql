-- Idempotent policy patch for Profiles UPDATE RLS
-- Safe to run in existing environments.

ALTER TABLE "Profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON "Profiles";

CREATE POLICY "Users can update own profile"
    ON "Profiles" FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (auth.uid() = "UserId");
