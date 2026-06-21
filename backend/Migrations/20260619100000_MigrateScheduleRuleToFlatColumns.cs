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
            migrationBuilder.AddColumn<string>(
                name: "ScheduleRule_Type",
                table: "Events",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_Month",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_WeekOfMonth",
                table: "Events",
                type: "integer",
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
                name: "ScheduleRule_MonthStart",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScheduleRule_MonthEnd",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ScheduleRule_Date",
                table: "Events",
                type: "date",
                nullable: true);

            // Copy data from the JSON column into the new flat columns.
            // Rows with no ScheduleRule (NULL) are skipped; JSON keys that are
            // null/absent cast to NULL in the target column automatically.
            migrationBuilder.Sql(@"
                UPDATE ""Events"" SET
                    ""ScheduleRule_Type""        = ""ScheduleRule"" ->> 'Type',
                    ""ScheduleRule_Month""        = (""ScheduleRule"" ->> 'Month')::int,
                    ""ScheduleRule_WeekOfMonth""  = (""ScheduleRule"" ->> 'WeekOfMonth')::int,
                    ""ScheduleRule_DayOfMonth""   = (""ScheduleRule"" ->> 'DayOfMonth')::int,
                    ""ScheduleRule_DayOfWeek""    = ""ScheduleRule"" ->> 'DayOfWeek',
                    ""ScheduleRule_MonthStart""   = (""ScheduleRule"" ->> 'MonthStart')::int,
                    ""ScheduleRule_MonthEnd""     = (""ScheduleRule"" ->> 'MonthEnd')::int,
                    ""ScheduleRule_Date""         = (""ScheduleRule"" ->> 'Date')::date
                WHERE ""ScheduleRule"" IS NOT NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ScheduleRule_Type", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_Month", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_WeekOfMonth", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_DayOfMonth", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_DayOfWeek", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_MonthStart", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_MonthEnd", table: "Events");
            migrationBuilder.DropColumn(name: "ScheduleRule_Date", table: "Events");
        }
    }
}
