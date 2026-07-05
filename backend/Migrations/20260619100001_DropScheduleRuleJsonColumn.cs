using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class DropScheduleRuleJsonColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScheduleRule",
                table: "Events");
        }

        /// <inheritdoc />
        // Down() cannot restore data that was in the JSON column.
        // To roll back, restore from a database backup taken before Phase 1.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ScheduleRule",
                table: "Events",
                type: "jsonb",
                nullable: true);
        }
    }
}
