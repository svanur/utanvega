using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class UpdateGpxDataToLineStringZ : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // First, force existing geometries to have a Z dimension (set to 0 if missing)
            migrationBuilder.Sql("UPDATE \"Trails\" SET \"GpxData\" = ST_Force3D(\"GpxData\") WHERE \"GpxData\" IS NOT NULL;");

            migrationBuilder.AlterColumn<Geometry>(
                name: "GpxData",
                table: "Trails",
                type: "geometry(LineStringZ, 4326)",
                nullable: true,
                oldClrType: typeof(Geometry),
                oldType: "geometry",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Geometry>(
                name: "GpxData",
                table: "Trails",
                type: "geometry",
                nullable: true,
                oldClrType: typeof(Geometry),
                oldType: "geometry(LineStringZ, 4326)",
                oldNullable: true);
        }
    }
}
