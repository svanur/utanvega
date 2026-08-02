using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailTranslationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Trails\" ADD COLUMN IF NOT EXISTS \"NameEn\" text;");
            migrationBuilder.Sql("ALTER TABLE \"Trails\" ADD COLUMN IF NOT EXISTS \"DescriptionEn\" text;");
            migrationBuilder.Sql("ALTER TABLE \"Trails\" ADD COLUMN IF NOT EXISTS \"TranslationHashes\" text;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "DescriptionEn", table: "Trails");
            migrationBuilder.DropColumn(name: "NameEn", table: "Trails");
            migrationBuilder.DropColumn(name: "TranslationHashes", table: "Trails");
        }
    }
}
