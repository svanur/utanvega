using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class RenameRaceStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE \"Races\" SET \"Status\" = 'Hidden' WHERE \"Status\" = 'Retired'");
            migrationBuilder.Sql(
                "UPDATE \"Races\" SET \"Status\" = 'Cancelled' WHERE \"Status\" = 'Inactive'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE \"Races\" SET \"Status\" = 'Retired' WHERE \"Status\" = 'Hidden'");
            migrationBuilder.Sql(
                "UPDATE \"Races\" SET \"Status\" = 'Inactive' WHERE \"Status\" = 'Cancelled'");
        }
    }
}
