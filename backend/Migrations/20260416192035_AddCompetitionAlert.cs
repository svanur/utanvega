using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddCompetitionAlert : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AlertMessage",
                table: "Competitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AlertSeverity",
                table: "Competitions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AlertMessage",
                table: "Competitions");

            migrationBuilder.DropColumn(
                name: "AlertSeverity",
                table: "Competitions");
        }
    }
}
