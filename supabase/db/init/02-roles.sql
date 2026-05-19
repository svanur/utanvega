-- Keep the local stack aligned with Supabase's role setup.
\set pgpass `echo "$POSTGRES_PASSWORD"`

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        EXECUTE format('ALTER USER authenticator WITH PASSWORD %L', :'pgpass');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
        EXECUTE format('ALTER USER pgbouncer WITH PASSWORD %L', :'pgpass');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        EXECUTE format('ALTER USER supabase_auth_admin WITH PASSWORD %L', :'pgpass');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
        EXECUTE format('ALTER USER supabase_functions_admin WITH PASSWORD %L', :'pgpass');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        EXECUTE format('ALTER USER supabase_storage_admin WITH PASSWORD %L', :'pgpass');
    END IF;
END $$;
