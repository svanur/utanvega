using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailViewIpHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IpHash",
                table: "TrailViews",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrailViews_TrailId_IpHash_ViewedAtUtc",
                table: "TrailViews",
                columns: new[] { "TrailId", "IpHash", "ViewedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TrailViews_TrailId_IpHash_ViewedAtUtc",
                table: "TrailViews");

            migrationBuilder.DropColumn(
                name: "IpHash",
                table: "TrailViews");
        }
    }
}
