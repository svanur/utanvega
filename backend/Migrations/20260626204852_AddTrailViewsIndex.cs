using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailViewsIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS guards against re-running on a DB where the index was created manually.
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_TrailViews_TrailId"" ON ""TrailViews"" (""TrailId"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_TrailViews_TrailId"";");
        }
    }
}
