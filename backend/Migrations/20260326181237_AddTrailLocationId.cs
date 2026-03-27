using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailLocationId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_TrailLocations",
                table: "TrailLocations");

            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "TrailLocations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddPrimaryKey(
                name: "PK_TrailLocations",
                table: "TrailLocations",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_TrailLocations_TrailId",
                table: "TrailLocations",
                column: "TrailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_TrailLocations",
                table: "TrailLocations");

            migrationBuilder.DropIndex(
                name: "IX_TrailLocations_TrailId",
                table: "TrailLocations");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "TrailLocations");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TrailLocations",
                table: "TrailLocations",
                columns: new[] { "TrailId", "LocationId", "Role" });
        }
    }
}
