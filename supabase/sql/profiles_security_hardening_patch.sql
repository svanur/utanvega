-- Combined idempotent security patch for Profiles.
-- Applies:
-- 1) UPDATE policy hardening (USING + WITH CHECK)
-- 2) Authoritative DB-side profile defaults and UpdatedAt handling

ALTER TABLE "Profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON "Profiles";

CREATE POLICY "Users can update own profile"
    ON "Profiles" FOR UPDATE
    USING (auth.uid() = "UserId")
    WITH CHECK (auth.uid() = "UserId");

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
