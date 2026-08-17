using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizerSlug : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Organizers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            // Populate slugs from Names using the same Icelandic character map as SlugGenerator.Generate()
            migrationBuilder.Sql(@"
                UPDATE ""Organizers"" SET ""Slug"" =
                    REGEXP_REPLACE(
                    REGEXP_REPLACE(
                    REGEXP_REPLACE(
                    LOWER(
                        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(""Name"",
                        'á', 'a'), 'Á', 'a'), 'é', 'e'), 'É', 'e'), 'í', 'i'), 'Í', 'i'),
                        'ó', 'o'), 'Ó', 'o'), 'ú', 'u'), 'Ú', 'u'), 'ý', 'y'), 'Ý', 'y'),
                        'þ', 'th'), 'Þ', 'th'), 'æ', 'ae'), 'Æ', 'ae'), 'ö', 'o'), 'Ö', 'o')
                    ),
                    '[^a-z0-9]+', '-', 'g'),
                    '-+', '-', 'g'),
                    '^-|-$', '', 'g')
                WHERE ""Slug"" = ''
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Organizers_Slug",
                table: "Organizers",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Organizers_Slug",
                table: "Organizers");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Organizers");
        }
    }
}
