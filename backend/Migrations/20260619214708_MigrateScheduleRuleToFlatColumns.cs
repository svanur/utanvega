using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utanvega.Backend.Migrations
{
    /// <inheritdoc />
    public partial class MigrateScheduleRuleToFlatColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add flat columns first so data can be copied into them.
            migrationBuilder.AddColumn<DateOnly>(
                name: "ScheduleRule_Date",
                table: "Events",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_DayOfMonth",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScheduleRule_DayOfWeek",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_Month",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_MonthEnd",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_MonthStart",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScheduleRule_Type",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_WeekOfMonth",
                table: "Events",
                type: "integer",
                nullable: true);

            // 2. Copy data out of the JSON column into the flat columns.
            migrationBuilder.Sql(@"
                UPDATE ""Events"" SET
                    ""ScheduleRule_Type""       = ""ScheduleRule"" ->> 'Type',
                    ""ScheduleRule_Month""       = (""ScheduleRule"" ->> 'Month')::int,
                    ""ScheduleRule_WeekOfMonth"" = (""ScheduleRule"" ->> 'WeekOfMonth')::int,
                    ""ScheduleRule_DayOfMonth""  = (""ScheduleRule"" ->> 'DayOfMonth')::int,
                    ""ScheduleRule_DayOfWeek""   = ""ScheduleRule"" ->> 'DayOfWeek',
                    ""ScheduleRule_MonthStart""  = (""ScheduleRule"" ->> 'MonthStart')::int,
                    ""ScheduleRule_MonthEnd""    = (""ScheduleRule"" ->> 'MonthEnd')::int,
                    ""ScheduleRule_Date""        = (""ScheduleRule"" ->> 'Date')::date
                WHERE ""ScheduleRule"" IS NOT NULL;
            ");

            // 3. Drop the JSON column now that data has been copied.
            migrationBuilder.DropColumn(
                name: "ScheduleRule",
                table: "Events");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScheduleRule_Date",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_DayOfMonth",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_DayOfWeek",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_Month",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_MonthEnd",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_MonthStart",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_Type",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ScheduleRule_WeekOfMonth",
                table: "Events");

            migrationBuilder.AddColumn<string>(
                name: "ScheduleRule",
                table: "Events",
                type: "jsonb",
                nullable: true);
        }
    }
}
