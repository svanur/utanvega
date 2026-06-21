START TRANSACTION;
ALTER TABLE "Events" ADD "ScheduleRule_Date" date;

ALTER TABLE "Events" ADD "ScheduleRule_DayOfMonth" integer;

ALTER TABLE "Events" ADD "ScheduleRule_DayOfWeek" text;

ALTER TABLE "Events" ADD "ScheduleRule_Month" integer;

ALTER TABLE "Events" ADD "ScheduleRule_MonthEnd" integer;

ALTER TABLE "Events" ADD "ScheduleRule_MonthStart" integer;

ALTER TABLE "Events" ADD "ScheduleRule_Type" text;

ALTER TABLE "Events" ADD "ScheduleRule_WeekOfMonth" integer;


                UPDATE "Events" SET
                    "ScheduleRule_Type"       = "ScheduleRule" ->> 'Type',
                    "ScheduleRule_Month"       = ("ScheduleRule" ->> 'Month')::int,
                    "ScheduleRule_WeekOfMonth" = ("ScheduleRule" ->> 'WeekOfMonth')::int,
                    "ScheduleRule_DayOfMonth"  = ("ScheduleRule" ->> 'DayOfMonth')::int,
                    "ScheduleRule_DayOfWeek"   = "ScheduleRule" ->> 'DayOfWeek',
                    "ScheduleRule_MonthStart"  = ("ScheduleRule" ->> 'MonthStart')::int,
                    "ScheduleRule_MonthEnd"    = ("ScheduleRule" ->> 'MonthEnd')::int,
                    "ScheduleRule_Date"        = ("ScheduleRule" ->> 'Date')::date
                WHERE "ScheduleRule" IS NOT NULL;
            

ALTER TABLE "Events" DROP COLUMN "ScheduleRule";

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260619214708_MigrateScheduleRuleToFlatColumns', '9.0.17');

COMMIT;

