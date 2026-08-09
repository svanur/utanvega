using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackPriorityGitHubComment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdminComment",
                table: "Feedback",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GitHubIssue",
                table: "Feedback",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "Feedback",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdminComment",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "GitHubIssue",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "Feedback");
        }
    }
}
