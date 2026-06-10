using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyIdAndReorderColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'UserTrailActivities'
                          AND column_name = 'LegacyId'
                    ) THEN
                        ALTER TABLE public.""UserTrailActivities"" DROP COLUMN ""LegacyId"";
                    END IF;
                END
                $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'UserTrailActivities'
                          AND column_name = 'LegacyId'
                    ) THEN
                        ALTER TABLE public.""UserTrailActivities"" ADD COLUMN ""LegacyId"" bigint NULL;
                    END IF;
                END
                $$;");
        }
    }
}
