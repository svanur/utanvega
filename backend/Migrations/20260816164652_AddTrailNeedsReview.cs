using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailNeedsReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NeedsReview",
                table: "Trails",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // 'Flagged' was a status that hid the trail from the public site while meaning
            // "come back to this later" — two unrelated things in one field. Carry those trails
            // over to the dedicated flag, and to 'Draft' so their visibility is unchanged.
            migrationBuilder.Sql(
                "UPDATE \"Trails\" SET \"NeedsReview\" = true, \"Status\" = 'Draft' WHERE \"Status\" = 'Flagged'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NeedsReview",
                table: "Trails");
        }
    }
}
