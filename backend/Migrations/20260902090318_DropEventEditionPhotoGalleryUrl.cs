using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations;

/// <inheritdoc />
public partial class DropEventEditionPhotoGalleryUrl : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "PhotoGalleryUrl",
            table: "EventEditions");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PhotoGalleryUrl",
            table: "EventEditions",
            type: "text",
            nullable: true);
    }
}
