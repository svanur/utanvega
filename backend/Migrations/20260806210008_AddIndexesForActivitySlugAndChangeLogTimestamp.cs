using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddIndexesForActivitySlugAndChangeLogTimestamp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_UserTrailActivities_TrailSlug_IsPublic",
                table: "UserTrailActivities",
                columns: new[] { "TrailSlug", "IsPublic" });

            migrationBuilder.CreateIndex(
                name: "IX_ChangeLogs_TimestampUtc",
                table: "ChangeLogs",
                column: "TimestampUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserTrailActivities_TrailSlug_IsPublic",
                table: "UserTrailActivities");

            migrationBuilder.DropIndex(
                name: "IX_ChangeLogs_TimestampUtc",
                table: "ChangeLogs");
        }
    }
}
