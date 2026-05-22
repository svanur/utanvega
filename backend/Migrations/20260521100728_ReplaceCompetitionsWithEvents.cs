using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceCompetitionsWithEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Races_Competitions_CompetitionId",
                table: "Races");

            migrationBuilder.DropTable(
                name: "Competitions");

            migrationBuilder.RenameColumn(
                name: "CompetitionId",
                table: "Races",
                newName: "EventEditionId");

            migrationBuilder.RenameIndex(
                name: "IX_Races_CompetitionId",
                table: "Races",
                newName: "IX_Races_EventEditionId");

            migrationBuilder.AddColumn<string>(
                name: "CertifiedBy",
                table: "Races",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChampionshipCategory",
                table: "Races",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateOfRace",
                table: "Races",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ItraPoints",
                table: "Races",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxParticipants",
                table: "Races",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrizeMoney",
                table: "Races",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime",
                table: "Races",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TicketStatus",
                table: "Races",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    OrganizerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OrganizerWebsite = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AlertMessage = table.Column<string>(type: "text", nullable: true),
                    AlertSeverity = table.Column<string>(type: "text", nullable: true),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ScheduleRule = table.Column<string>(type: "jsonb", nullable: true),
                    SocialLinks = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Events_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "EventEditions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrailId = table.Column<Guid>(type: "uuid", nullable: true),
                    Year = table.Column<int>(type: "integer", nullable: true),
                    Date = table.Column<DateOnly>(type: "date", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RegistrationUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ResultsUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    RegistrationStatus = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventEditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventEditions_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventEditions_Trails_TrailId",
                        column: x => x.TrailId,
                        principalTable: "Trails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventEditions_Date",
                table: "EventEditions",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_EventEditions_EventId",
                table: "EventEditions",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_EventEditions_TrailId",
                table: "EventEditions",
                column: "TrailId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_LocationId",
                table: "Events",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_Events_Slug",
                table: "Events",
                column: "Slug",
                unique: true);

            // Data-destructive: deletes all existing Race rows. The old Competitions model is being
            // replaced entirely — EventEditions is empty at this point, so all Races with the renamed
            // CompetitionId → EventEditionId column will be removed before the FK constraint is added.
            migrationBuilder.Sql("DELETE FROM \"Races\" WHERE \"EventEditionId\" NOT IN (SELECT \"Id\" FROM \"EventEditions\")");

            migrationBuilder.AddForeignKey(
                name: "FK_Races_EventEditions_EventEditionId",
                table: "Races",
                column: "EventEditionId",
                principalTable: "EventEditions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // Rename TrailStatus enum value: RaceOnly → EventOnly
            migrationBuilder.Sql("UPDATE \"Trails\" SET \"Status\" = 'EventOnly' WHERE \"Status\" = 'RaceOnly'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Races_EventEditions_EventEditionId",
                table: "Races");

            migrationBuilder.DropTable(
                name: "EventEditions");

            migrationBuilder.DropTable(
                name: "Events");

            migrationBuilder.DropColumn(
                name: "CertifiedBy",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "ChampionshipCategory",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "DateOfRace",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "ItraPoints",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "MaxParticipants",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "PrizeMoney",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "TicketStatus",
                table: "Races");

            migrationBuilder.RenameColumn(
                name: "EventEditionId",
                table: "Races",
                newName: "CompetitionId");

            migrationBuilder.RenameIndex(
                name: "IX_Races_EventEditionId",
                table: "Races",
                newName: "IX_Races_CompetitionId");

            migrationBuilder.CreateTable(
                name: "Competitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    AlertMessage = table.Column<string>(type: "text", nullable: true),
                    AlertSeverity = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrganizerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OrganizerWebsite = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RegistrationUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ScheduleRule = table.Column<string>(type: "jsonb", nullable: true),
                    Slug = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Competitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Competitions_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Competitions_LocationId",
                table: "Competitions",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_Competitions_Slug",
                table: "Competitions",
                column: "Slug",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Races_Competitions_CompetitionId",
                table: "Races",
                column: "CompetitionId",
                principalTable: "Competitions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
