using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPhotoGallery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhotoGalleries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventEditionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    PhotographerId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhotoGalleries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhotoGalleries_EventEditions_EventEditionId",
                        column: x => x.EventEditionId,
                        principalTable: "EventEditions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PhotoGalleries_Photographers_PhotographerId",
                        column: x => x.PhotographerId,
                        principalTable: "Photographers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhotoGalleries_EventEditionId",
                table: "PhotoGalleries",
                column: "EventEditionId");

            migrationBuilder.CreateIndex(
                name: "IX_PhotoGalleries_PhotographerId",
                table: "PhotoGalleries",
                column: "PhotographerId");

            // One-off data migration: every EventEdition that already has a legacy PhotoGalleryUrl
            // gets a corresponding PhotoGallery row (unattributed, first in sort order) so existing
            // gallery links keep working once consumers move to the new table. The legacy column
            // itself is left untouched — dropping it is #492.
            migrationBuilder.Sql(@"
                INSERT INTO ""PhotoGalleries"" (""Id"", ""EventEditionId"", ""Url"", ""PhotographerId"", ""Title"", ""TitleEn"", ""SortOrder"", ""CreatedAt"", ""CreatedBy"")
                SELECT gen_random_uuid(), ""Id"", ""PhotoGalleryUrl"", NULL, NULL, NULL, 0, now(), NULL
                FROM ""EventEditions""
                WHERE ""PhotoGalleryUrl"" IS NOT NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhotoGalleries");
        }
    }
}
