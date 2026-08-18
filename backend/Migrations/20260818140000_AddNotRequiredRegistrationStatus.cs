using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddNotRequiredRegistrationStatus : Migration
    {
        // No schema change required: EventEditions.RegistrationStatus is a free-text column with no
        // CHECK constraint, so the new "NotRequired" value is valid immediately. This migration
        // marks the point in history when NotRequired was added as a recognised RegistrationStatus.

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
