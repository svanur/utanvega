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
            // To reorder columns in PostgreSQL, we need to recreate the table
            // Create temporary table with correct column order
            migrationBuilder.Sql(@"
                CREATE TABLE ""UserTrailActivities_New"" (
                    ""Id"" uuid NOT NULL,
                    ""UserId"" uuid NOT NULL,
                    ""TrailSlug"" character varying NOT NULL,
                    ""LogDate"" date,
                    ""TimeInSeconds"" integer NOT NULL,
                    ""Distance"" numeric,
                    ""ElevationGain"" integer,
                    ""Notes"" character varying,
                    ""IsPublic"" boolean NOT NULL DEFAULT false,
                    ""LoggedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                    ""UpdatedAt"" timestamp with time zone,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT ""PK_UserTrailActivities_New"" PRIMARY KEY (""Id"")
                );
            ");

            // Copy data from old table to new table
            migrationBuilder.Sql(@"
                INSERT INTO ""UserTrailActivities_New"" 
                (""Id"", ""UserId"", ""TrailSlug"", ""LogDate"", ""TimeInSeconds"", ""Distance"", ""ElevationGain"", ""Notes"", ""IsPublic"", ""LoggedAt"", ""UpdatedAt"", ""CreatedAt"")
                SELECT 
                    ""Id"", ""UserId"", ""TrailSlug"", ""LogDate"", ""TimeInSeconds"", ""Distance"", ""ElevationGain"", ""Notes"", ""IsPublic"", ""LoggedAt"", ""UpdatedAt"", ""CreatedAt""
                FROM ""UserTrailActivities"";
            ");

            // Drop old indexes
            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_UserId_TrailSlug_LogDate",
                table: "UserTrailActivities");

            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_UserId",
                table: "UserTrailActivities");

            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_LogDate",
                table: "UserTrailActivities");

            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_CreatedAt",
                table: "UserTrailActivities");

            // Drop primary key and old table
            migrationBuilder.Sql(@"
                ALTER TABLE ""UserTrailActivities"" DROP CONSTRAINT ""PK_UserTrailActivities"";
                DROP TABLE ""UserTrailActivities"";
                ALTER TABLE ""UserTrailActivities_New"" RENAME TO ""UserTrailActivities"";
                ALTER TABLE ""UserTrailActivities"" RENAME CONSTRAINT ""PK_UserTrailActivities_New"" TO ""PK_UserTrailActivities"";
            ");

            // Recreate indexes
            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_CreatedAt",
                table: "UserTrailActivities",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_LogDate",
                table: "UserTrailActivities",
                column: "LogDate");

            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_UserId",
                table: "UserTrailActivities",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_UserId_TrailSlug_LogDate",
                table: "UserTrailActivities",
                columns: new[] { "UserId", "TrailSlug", "LogDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // To rollback, recreate the old table with legacy_id
            migrationBuilder.Sql(@"
                CREATE TABLE ""UserTrailActivities_Old"" (
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                    ""UserId"" uuid NOT NULL,
                    ""TrailSlug"" character varying NOT NULL,
                    ""TimeInSeconds"" integer NOT NULL,
                    ""Notes"" character varying,
                    ""IsPublic"" boolean NOT NULL DEFAULT false,
                    ""LoggedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                    ""UpdatedAt"" timestamp with time zone,
                    ""Distance"" numeric,
                    ""ElevationGain"" integer,
                    ""LogDate"" date,
                    ""LegacyId"" bigint,
                    ""Id"" uuid NOT NULL,
                    CONSTRAINT ""PK_UserTrailActivities"" PRIMARY KEY (""Id"")
                );
            ");

            // Copy data back
            migrationBuilder.Sql(@"
                INSERT INTO ""UserTrailActivities_Old""
                (""CreatedAt"", ""UserId"", ""TrailSlug"", ""TimeInSeconds"", ""Notes"", ""IsPublic"", ""LoggedAt"", ""UpdatedAt"", ""Distance"", ""ElevationGain"", ""LogDate"", ""Id"")
                SELECT
                    ""CreatedAt"", ""UserId"", ""TrailSlug"", ""TimeInSeconds"", ""Notes"", ""IsPublic"", ""LoggedAt"", ""UpdatedAt"", ""Distance"", ""ElevationGain"", ""LogDate"", ""Id""
                FROM ""UserTrailActivities"";
            ");

            // Drop new table and recreate old one
            migrationBuilder.Sql(@"
                DROP TABLE ""UserTrailActivities"";
                ALTER TABLE ""UserTrailActivities_Old"" RENAME TO ""UserTrailActivities"";
            ");

            // Recreate old indexes
            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_user_id_trail_slug",
                table: "UserTrailActivities",
                columns: new[] { "UserId", "TrailSlug" });

            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_CreatedAt",
                table: "UserTrailActivities",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_LogDate",
                table: "UserTrailActivities",
                column: "LogDate");

            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_UserId",
                table: "UserTrailActivities",
                column: "UserId");
        }
    }
}
