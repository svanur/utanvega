\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
