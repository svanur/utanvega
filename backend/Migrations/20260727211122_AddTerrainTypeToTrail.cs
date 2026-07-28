using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTerrainTypeToTrail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TerrainType",
                table: "Trails",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TerrainType",
                table: "Trails");
        }
    }
}
