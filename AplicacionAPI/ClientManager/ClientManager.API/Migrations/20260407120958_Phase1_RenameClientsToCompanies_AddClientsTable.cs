using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ClientManager.API.Migrations
{
    /// <inheritdoc />
    public partial class Phase1_RenameClientsToCompanies_AddClientsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Drop old indexes on Clients (if they exist) before renaming the table ──
            // Using conditional SQL because the indexes may or may not exist depending
            // on how the database was originally created.
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Clients_Status') THEN
                        DROP INDEX "IX_Clients_Status";
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Clients_UpdatedAt') THEN
                        DROP INDEX "IX_Clients_UpdatedAt";
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Clients_Name') THEN
                        DROP INDEX "IX_Clients_Name";
                    END IF;
                END $$;
                """);

            // ── Rename the table (preserves all data and the primary key) ──
            migrationBuilder.RenameTable(
                name: "Clients",
                newName: "Companies");

            // ── Rename the primary key constraint (keeps old name after table rename) ──
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_Clients' AND conrelid = 'public."Companies"'::regclass) THEN
                        ALTER TABLE "Companies" RENAME CONSTRAINT "PK_Clients" TO "PK_Companies";
                    END IF;
                END $$;
                """);

            // ── Recreate indexes on Companies with correct names ──
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Companies_Status') THEN
                        CREATE INDEX "IX_Companies_Status" ON "Companies" ("Status");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Companies_UpdatedAt') THEN
                        CREATE INDEX "IX_Companies_UpdatedAt" ON "Companies" ("UpdatedAt");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Companies_Name') THEN
                        CREATE INDEX "IX_Companies_Name" ON "Companies" ("Name");
                    END IF;
                END $$;
                """);

            // ── Create the new Clients table (persons assigned to a company) ──
            migrationBuilder.CreateTable(
                name: "Clients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Clients_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CompanyId",
                table: "Clients",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_Email",
                table: "Clients",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_Name",
                table: "Clients",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Clients");

            // Drop Companies indexes before renaming back
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Companies_Status') THEN
                        DROP INDEX "IX_Companies_Status";
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Companies_UpdatedAt') THEN
                        DROP INDEX "IX_Companies_UpdatedAt";
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Companies_Name') THEN
                        DROP INDEX "IX_Companies_Name";
                    END IF;
                END $$;
                """);

            migrationBuilder.RenameTable(
                name: "Companies",
                newName: "Clients");

            // Rename primary key back
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_Companies' AND conrelid = 'public."Clients"'::regclass) THEN
                        ALTER TABLE "Clients" RENAME CONSTRAINT "PK_Companies" TO "PK_Clients";
                    END IF;
                END $$;
                """);

            // Recreate original indexes on Clients
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Clients_Status') THEN
                        CREATE INDEX "IX_Clients_Status" ON "Clients" ("Status");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Clients_UpdatedAt') THEN
                        CREATE INDEX "IX_Clients_UpdatedAt" ON "Clients" ("UpdatedAt");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IX_Clients_Name') THEN
                        CREATE INDEX "IX_Clients_Name" ON "Clients" ("Name");
                    END IF;
                END $$;
                """);
        }
    }
}
