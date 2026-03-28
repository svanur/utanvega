using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "Trails",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Type",
                table: "Trails");
        }
    }
}
