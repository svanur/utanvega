using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class RefactorStatusEnums : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate RaceStatus.Upcoming → Active (no functional distinction)
            migrationBuilder.Sql("""
                UPDATE "Races" SET "Status" = 'Active' WHERE "Status" = 'Upcoming';
                """);

            // Migrate TrailStatus.Deleted → Archived (collapsed into one soft-delete value)
            migrationBuilder.Sql("""
                UPDATE "Trails" SET "Status" = 'Archived' WHERE "Status" = 'Deleted';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op: cannot distinguish original Upcoming vs Active after merge
        }
    }
}
