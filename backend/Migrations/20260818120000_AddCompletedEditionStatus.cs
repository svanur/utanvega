using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddCompletedEditionStatus : Migration
    {
        // No schema change required: EventEditions.Status is a free-text column with no CHECK
        // constraint, so the new "Completed" value is valid immediately. This migration exists
        // to mark the point in history when Completed was added as a recognised EditionStatus.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
