using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailViewsIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_TrailViews_TrailId",
                table: "TrailViews",
                column: "TrailId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TrailViews_TrailId",
                table: "TrailViews");
        }
    }
}
