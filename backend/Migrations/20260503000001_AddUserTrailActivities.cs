using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTrailActivities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF to_regclass('public.""UserTrailActivities""') IS NULL THEN
        CREATE TABLE public.""UserTrailActivities"" (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            trail_slug character varying(250) NOT NULL,
            time integer NOT NULL,
            distance numeric(8,2) NULL,
            elevation_gain integer NULL,
            log_date date NULL,
            notes character varying(500) NULL,
            is_public boolean NOT NULL DEFAULT false,
            logged_at timestamp with time zone NOT NULL DEFAULT now(),
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NULL,
            CONSTRAINT ""PK_UserTrailActivities"" PRIMARY KEY (id)
        );
    END IF;
END
$$;");

            migrationBuilder.Sql(@"
DO $$
BEGIN
    -- Legacy Supabase table used PascalCase columns; normalize to snake_case used by EF mapping.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'UserId'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""UserId"" TO user_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'TrailSlug'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""TrailSlug"" TO trail_slug;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'Time'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""Time"" TO time;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'Distance'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""Distance"" TO distance;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'ElevationGain'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""ElevationGain"" TO elevation_gain;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'LogDate'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""LogDate"" TO log_date;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'Notes'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""Notes"" TO notes;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'IsPublic'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""IsPublic"" TO is_public;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'LoggedAt'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""LoggedAt"" TO logged_at;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'CreatedAt'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""CreatedAt"" TO created_at;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'UpdatedAt'
    ) THEN
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN ""UpdatedAt"" TO updated_at;
    END IF;
END
$$;");

            migrationBuilder.Sql(@"
DO $$
DECLARE
    id_data_type text;
BEGIN
    SELECT data_type
    INTO id_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'id';

    -- Legacy schema used bigint identity for id. Convert to uuid while preserving old numeric IDs.
    IF id_data_type = 'bigint' THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'legacy_id'
        ) THEN
            ALTER TABLE public.""UserTrailActivities"" ADD COLUMN legacy_id bigint;
            UPDATE public.""UserTrailActivities"" SET legacy_id = id WHERE legacy_id IS NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'UserTrailActivities' AND column_name = 'id_uuid'
        ) THEN
            ALTER TABLE public.""UserTrailActivities"" ADD COLUMN id_uuid uuid;
            UPDATE public.""UserTrailActivities"" SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
        END IF;

        ALTER TABLE public.""UserTrailActivities"" DROP CONSTRAINT IF EXISTS ""UserTrailActivities_pkey"";
        ALTER TABLE public.""UserTrailActivities"" DROP CONSTRAINT IF EXISTS ""PK_UserTrailActivities"";

        ALTER TABLE public.""UserTrailActivities"" DROP COLUMN id;
        ALTER TABLE public.""UserTrailActivities"" RENAME COLUMN id_uuid TO id;

        ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.""UserTrailActivities"" ADD CONSTRAINT ""PK_UserTrailActivities"" PRIMARY KEY (id);
    END IF;
END
$$;");

            migrationBuilder.Sql(@"
DO $$
DECLARE
    v_type text;
BEGIN
    -- Only alter type when needed; avoids failing on columns referenced by RLS policies.
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'user_id' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'uuid' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN user_id TYPE uuid USING user_id::uuid';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'trail_slug' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'character varying(250)' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN trail_slug TYPE character varying(250)';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'time' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'integer' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN time TYPE integer USING time::integer';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'distance' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'numeric(8,2)' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN distance TYPE numeric(8,2) USING distance::numeric(8,2)';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'elevation_gain' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'integer' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN elevation_gain TYPE integer USING elevation_gain::integer';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'log_date' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'date' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN log_date TYPE date USING log_date::date';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'notes' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'character varying(500)' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN notes TYPE character varying(500)';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'is_public' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'boolean' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN is_public TYPE boolean USING is_public::boolean';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'logged_at' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'timestamp with time zone' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN logged_at TYPE timestamp with time zone USING logged_at::timestamptz';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'created_at' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'timestamp with time zone' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN created_at TYPE timestamp with time zone USING created_at::timestamptz';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'UserTrailActivities' AND a.attname = 'updated_at' AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_type IS DISTINCT FROM 'timestamp with time zone' THEN
        EXECUTE 'ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at::timestamptz';
    END IF;

    ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN trail_slug SET NOT NULL;
    ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN time SET NOT NULL;
    ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN is_public SET NOT NULL;
    ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN logged_at SET NOT NULL;
    ALTER TABLE public.""UserTrailActivities"" ALTER COLUMN created_at SET NOT NULL;
END
$$;");

            migrationBuilder.Sql(@"
CREATE INDEX IF NOT EXISTS ""IX_UserTrailActivities_created_at"" ON public.""UserTrailActivities"" (created_at);
CREATE INDEX IF NOT EXISTS ""IX_UserTrailActivities_log_date"" ON public.""UserTrailActivities"" (log_date);
CREATE INDEX IF NOT EXISTS ""IX_UserTrailActivities_user_id"" ON public.""UserTrailActivities"" (user_id);
CREATE INDEX IF NOT EXISTS ""IX_UserTrailActivities_user_id_trail_slug"" ON public.""UserTrailActivities"" (user_id, trail_slug);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "UserTrailActivities");
        }
    }
}

