-- Supabase RLS hardening for client-exposed tables.
-- Safe to run multiple times (idempotent) and safe when some tables are not present yet.

-- Profiles -------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public."Profiles"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "Profiles" ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Profiles are publicly readable" ON "Profiles"';
        EXECUTE 'CREATE POLICY "Profiles are publicly readable" ON "Profiles" FOR SELECT USING (true)';

        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own profile" ON "Profiles"';
        EXECUTE 'CREATE POLICY "Users can insert own profile" ON "Profiles" FOR INSERT WITH CHECK (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON "Profiles"';
        EXECUTE 'CREATE POLICY "Users can update own profile" ON "Profiles" FOR UPDATE USING (auth.uid() = "UserId") WITH CHECK (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own profile" ON "Profiles"';
        EXECUTE 'CREATE POLICY "Users can delete own profile" ON "Profiles" FOR DELETE USING (auth.uid() = "UserId")';
    END IF;
END $$;

-- UserTickedTrails -----------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public."UserTickedTrails"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "UserTickedTrails" ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can read own ticked trails" ON "UserTickedTrails"';
        EXECUTE 'CREATE POLICY "Users can read own ticked trails" ON "UserTickedTrails" FOR SELECT USING (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own ticked trails" ON "UserTickedTrails"';
        EXECUTE 'CREATE POLICY "Users can insert own ticked trails" ON "UserTickedTrails" FOR INSERT WITH CHECK (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can update own ticked trails" ON "UserTickedTrails"';
        EXECUTE 'CREATE POLICY "Users can update own ticked trails" ON "UserTickedTrails" FOR UPDATE USING (auth.uid() = "UserId") WITH CHECK (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own ticked trails" ON "UserTickedTrails"';
        EXECUTE 'CREATE POLICY "Users can delete own ticked trails" ON "UserTickedTrails" FOR DELETE USING (auth.uid() = "UserId")';
    END IF;
END $$;

-- TrailCheckIns --------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public."TrailCheckIns"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "TrailCheckIns" ENABLE ROW LEVEL SECURITY';

        -- Public read keeps the trail details check-in list/realtime visible.
        EXECUTE 'DROP POLICY IF EXISTS "Trail check-ins are publicly readable" ON "TrailCheckIns"';
        EXECUTE 'CREATE POLICY "Trail check-ins are publicly readable" ON "TrailCheckIns" FOR SELECT USING (true)';
    END IF;
END $$;

-- UserTrailActivities --------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public."UserTrailActivities"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "UserTrailActivities" ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can read own trail activities" ON "UserTrailActivities"';
        EXECUTE 'CREATE POLICY "Users can read own trail activities" ON "UserTrailActivities" FOR SELECT USING (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own trail activities" ON "UserTrailActivities"';
        EXECUTE 'CREATE POLICY "Users can insert own trail activities" ON "UserTrailActivities" FOR INSERT WITH CHECK (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can update own trail activities" ON "UserTrailActivities"';
        EXECUTE 'CREATE POLICY "Users can update own trail activities" ON "UserTrailActivities" FOR UPDATE USING (auth.uid() = "UserId") WITH CHECK (auth.uid() = "UserId")';

        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own trail activities" ON "UserTrailActivities"';
        EXECUTE 'CREATE POLICY "Users can delete own trail activities" ON "UserTrailActivities" FOR DELETE USING (auth.uid() = "UserId")';
    END IF;
END $$;

-- Verification helpers -------------------------------------------------------
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('Profiles', 'UserTickedTrails', 'TrailCheckIns', 'UserTrailActivities')
-- ORDER BY tablename;
--
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('Profiles', 'UserTickedTrails', 'TrailCheckIns', 'UserTrailActivities')
-- ORDER BY tablename, policyname;
