-- Supabase RLS Policy Security Checklist
-- Use this checklist whenever you add or change policies.

-- 1) Ensure RLS is enabled on every exposed table.
--    ALTER TABLE "YourTable" ENABLE ROW LEVEL SECURITY;

-- 2) FOR UPDATE policies should usually include BOTH:
--    USING (...)      -- checks existing row visibility
--    WITH CHECK (...) -- checks proposed new row values
--    This prevents ownership/key changes that pass USING but violate post-update ownership.

-- 3) Verify INSERT policies use WITH CHECK (...), not only USING (...).

-- 4) Ensure DELETE policies scope to row ownership/authorization.

-- 5) Keep policy predicates aligned with immutable ownership columns
--    (for example "UserId"), and avoid permissive fallbacks.

-- 6) Review grants explicitly (table + schema) for anon/authenticated/service roles.
--    RLS does not replace SQL privilege boundaries.

-- 7) Use idempotent deployment patches for existing environments:
--    DROP POLICY IF EXISTS ...;
--    CREATE POLICY ...;

-- 8) Verify installed policies from catalog after deployment:
--    SELECT policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename = 'YourTable'
--    ORDER BY policyname;

-- 9) Behavior checks (as authenticated user):
--    - Allowed own-row read/write succeeds.
--    - Cross-user read/write/delete fails.
--    - Ownership mutation attempts fail when not intended.

-- 10) Keep policy SQL alongside table SQL in this folder and code-review both together.
