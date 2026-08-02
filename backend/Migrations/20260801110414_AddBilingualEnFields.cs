using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddBilingualEnFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "Tags",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CertifiedByEn",
                table: "Races",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChampionshipCategoryEn",
                table: "Races",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescriptionEn",
                table: "Races",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "Races",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescriptionEn",
                table: "Organizers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescriptionEn",
                table: "Locations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "Locations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AlertMessageEn",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescriptionEn",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrganizerNameEn",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NotesEn",
                table: "EventEditions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TitleEn",
                table: "EventEditions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "Tags");

            migrationBuilder.DropColumn(
                name: "CertifiedByEn",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "ChampionshipCategoryEn",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "DescriptionEn",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "DescriptionEn",
                table: "Organizers");

            migrationBuilder.DropColumn(
                name: "DescriptionEn",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "AlertMessageEn",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "DescriptionEn",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "OrganizerNameEn",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "NotesEn",
                table: "EventEditions");

            migrationBuilder.DropColumn(
                name: "TitleEn",
                table: "EventEditions");
        }
    }
}
