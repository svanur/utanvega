GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;

DO $$
DECLARE
    fn_record RECORD;
BEGIN
    FOR fn_record IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth'
    LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO supabase_auth_admin', fn_record.signature);
    END LOOP;
END $$;
