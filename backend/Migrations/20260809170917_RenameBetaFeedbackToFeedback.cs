using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class RenameBetaFeedbackToFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_BetaFeedback",
                table: "BetaFeedback");

            migrationBuilder.RenameTable(
                name: "BetaFeedback",
                newName: "Feedback");

            migrationBuilder.RenameIndex(
                name: "IX_BetaFeedback_Status",
                table: "Feedback",
                newName: "IX_Feedback_Status");

            migrationBuilder.RenameIndex(
                name: "IX_BetaFeedback_CreatedAt",
                table: "Feedback",
                newName: "IX_Feedback_CreatedAt");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Feedback",
                table: "Feedback",
                column: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Feedback",
                table: "Feedback");

            migrationBuilder.RenameTable(
                name: "Feedback",
                newName: "BetaFeedback");

            migrationBuilder.RenameIndex(
                name: "IX_Feedback_Status",
                table: "BetaFeedback",
                newName: "IX_BetaFeedback_Status");

            migrationBuilder.RenameIndex(
                name: "IX_Feedback_CreatedAt",
                table: "BetaFeedback",
                newName: "IX_BetaFeedback_CreatedAt");

            migrationBuilder.AddPrimaryKey(
                name: "PK_BetaFeedback",
                table: "BetaFeedback",
                column: "Id");
        }
    }
}
