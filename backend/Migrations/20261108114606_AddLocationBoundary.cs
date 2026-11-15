using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddLocationBoundary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Polygon>(
                name: "Boundary",
                table: "Locations",
                type: "geometry(Polygon, 4326)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Locations_Boundary",
                table: "Locations",
                column: "Boundary")
                .Annotation("Npgsql:IndexMethod", "GIST");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Locations_Boundary",
                table: "Locations");

            migrationBuilder.DropColumn(
                name: "Boundary",
                table: "Locations");
        }
    }
}
