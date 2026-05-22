using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class MakeItraPointsNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "ItraPoints",
                table: "Races",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            // Legacy rows used 0 to mean "not ITRA certified". Convert to NULL where
            // CertifiedBy is empty (truly not affiliated) so 0 means "certified, 0 pts".
            migrationBuilder.Sql("""
                UPDATE "Races"
                SET "ItraPoints" = NULL
                WHERE "ItraPoints" = 0
                  AND ("CertifiedBy" IS NULL OR "CertifiedBy" = '')
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Races" SET "ItraPoints" = 0 WHERE "ItraPoints" IS NULL""");

            migrationBuilder.AlterColumn<int>(
                name: "ItraPoints",
                table: "Races",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
