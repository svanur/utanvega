using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class RenameEventStatusConfirmedToActive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE \"Events\" SET \"Status\" = 'Active' WHERE \"Status\" = 'Confirmed'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE \"Events\" SET \"Status\" = 'Confirmed' WHERE \"Status\" = 'Active'");
        }
    }
}
