using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class FixUserTrailActivitiesSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Delete duplicate activities, keeping one for each user/trail/date combination
            // Uses a subquery to keep the record with the latest created_at time
            migrationBuilder.Sql(@"
                WITH duplicates AS (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, trail_slug, log_date ORDER BY created_at DESC) as rn
                    FROM ""UserTrailActivities""
                )
                DELETE FROM ""UserTrailActivities""
                WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
            ");

            // Drop the old index
            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_user_id_trail_slug",
                table: "UserTrailActivities");

            // Rename columns to PascalCase
            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "UserTrailActivities",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "UserTrailActivities",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "trail_slug",
                table: "UserTrailActivities",
                newName: "TrailSlug");

            migrationBuilder.RenameColumn(
                name: "time",
                table: "UserTrailActivities",
                newName: "TimeInSeconds");

            migrationBuilder.RenameColumn(
                name: "notes",
                table: "UserTrailActivities",
                newName: "Notes");

            migrationBuilder.RenameColumn(
                name: "is_public",
                table: "UserTrailActivities",
                newName: "IsPublic");

            migrationBuilder.RenameColumn(
                name: "logged_at",
                table: "UserTrailActivities",
                newName: "LoggedAt");

            migrationBuilder.RenameColumn(
                name: "updated_at",
                table: "UserTrailActivities",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "distance",
                table: "UserTrailActivities",
                newName: "Distance");

            migrationBuilder.RenameColumn(
                name: "elevation_gain",
                table: "UserTrailActivities",
                newName: "ElevationGain");

            migrationBuilder.RenameColumn(
                name: "log_date",
                table: "UserTrailActivities",
                newName: "LogDate");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "UserTrailActivities",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "legacy_id",
                table: "UserTrailActivities",
                newName: "LegacyId");

            // Rename existing indexes
            migrationBuilder.RenameIndex(
                name: "IX_UserTrailActivities_user_id",
                table: "UserTrailActivities",
                newName: "IX_UserTrailActivities_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_UserTrailActivities_log_date",
                table: "UserTrailActivities",
                newName: "IX_UserTrailActivities_LogDate");

            migrationBuilder.RenameIndex(
                name: "IX_UserTrailActivities_created_at",
                table: "UserTrailActivities",
                newName: "IX_UserTrailActivities_CreatedAt");

            // Create new unique index on (UserId, TrailSlug, LogDate)
            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_UserId_TrailSlug_LogDate",
                table: "UserTrailActivities",
                columns: new[] { "UserId", "TrailSlug", "LogDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the new unique index
            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_UserId_TrailSlug_LogDate",
                table: "UserTrailActivities");

            // Rename columns back to snake_case
            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "UserTrailActivities",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "UserTrailActivities",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "TrailSlug",
                table: "UserTrailActivities",
                newName: "trail_slug");

            migrationBuilder.RenameColumn(
                name: "TimeInSeconds",
                table: "UserTrailActivities",
                newName: "time");

            migrationBuilder.RenameColumn(
                name: "Notes",
                table: "UserTrailActivities",
                newName: "notes");

            migrationBuilder.RenameColumn(
                name: "IsPublic",
                table: "UserTrailActivities",
                newName: "is_public");

            migrationBuilder.RenameColumn(
                name: "LoggedAt",
                table: "UserTrailActivities",
                newName: "logged_at");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "UserTrailActivities",
                newName: "updated_at");

            migrationBuilder.RenameColumn(
                name: "Distance",
                table: "UserTrailActivities",
                newName: "distance");

            migrationBuilder.RenameColumn(
                name: "ElevationGain",
                table: "UserTrailActivities",
                newName: "elevation_gain");

            migrationBuilder.RenameColumn(
                name: "LogDate",
                table: "UserTrailActivities",
                newName: "log_date");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "UserTrailActivities",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "LegacyId",
                table: "UserTrailActivities",
                newName: "legacy_id");

            // Rename indexes back
            migrationBuilder.RenameIndex(
                name: "IX_UserTrailActivities_UserId",
                table: "UserTrailActivities",
                newName: "IX_UserTrailActivities_user_id");

            migrationBuilder.RenameIndex(
                name: "IX_UserTrailActivities_LogDate",
                table: "UserTrailActivities",
                newName: "IX_UserTrailActivities_log_date");

            migrationBuilder.RenameIndex(
                name: "IX_UserTrailActivities_CreatedAt",
                table: "UserTrailActivities",
                newName: "IX_UserTrailActivities_created_at");

            // Recreate old index
            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_user_id_trail_slug",
                table: "UserTrailActivities",
                columns: new[] { "user_id", "trail_slug" });
        }
    }
}
