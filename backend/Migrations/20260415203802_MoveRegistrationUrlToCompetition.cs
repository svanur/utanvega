using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class MoveRegistrationUrlToCompetition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RegistrationUrl",
                table: "Races");

            migrationBuilder.AddColumn<string>(
                name: "RegistrationUrl",
                table: "Competitions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RegistrationUrl",
                table: "Competitions");

            migrationBuilder.AddColumn<string>(
                name: "RegistrationUrl",
                table: "Races",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }
    }
}
