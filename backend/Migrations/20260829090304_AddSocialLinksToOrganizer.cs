using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSocialLinksToOrganizer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SocialLinks",
                table: "Organizers",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SocialLinks",
                table: "Organizers");
        }
    }
}
