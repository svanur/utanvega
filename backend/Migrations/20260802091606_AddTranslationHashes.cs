using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTranslationHashes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TranslationHashes",
                table: "Tags",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TranslationHashes",
                table: "Races",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TranslationHashes",
                table: "Organizers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TranslationHashes",
                table: "Locations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TranslationHashes",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TranslationHashes",
                table: "EventEditions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TranslationHashes",
                table: "Tags");

            migrationBuilder.DropColumn(
                name: "TranslationHashes",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "TranslationHashes",
                table: "Organizers");

            migrationBuilder.DropColumn(
                name: "TranslationHashes",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "TranslationHashes",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "TranslationHashes",
                table: "EventEditions");
        }
    }
}
