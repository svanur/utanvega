using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations;

/// <inheritdoc />
public partial class DropEventPhotoGalleryUrl : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "PhotoGalleryUrl",
            table: "Events");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PhotoGalleryUrl",
            table: "Events",
            type: "text",
            nullable: true);
    }
}
