using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class RenameTerrainTypeValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Convert integer column to text, mapping old int enum values to new string names
            migrationBuilder.Sql(@"
                ALTER TABLE ""Trails""
                ALTER COLUMN ""TerrainType"" TYPE text
                USING CASE ""TerrainType""
                    WHEN 0 THEN 'Mountainous'
                    WHEN 1 THEN 'Hilly'
                    WHEN 2 THEN 'Flat'
                    ELSE NULL
                END;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Trails""
                ALTER COLUMN ""TerrainType"" TYPE integer
                USING CASE ""TerrainType""
                    WHEN 'Mountainous' THEN 0
                    WHEN 'Hilly' THEN 1
                    WHEN 'Flat' THEN 2
                    ELSE NULL
                END;
            ");
        }
    }
}
