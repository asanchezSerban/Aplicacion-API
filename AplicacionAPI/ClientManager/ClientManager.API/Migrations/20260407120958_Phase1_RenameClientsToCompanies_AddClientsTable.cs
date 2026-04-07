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
            // ── Rename existing Clients table to Companies (preserves all data) ──
            migrationBuilder.RenameIndex(
                name: "IX_Clients_Status",
                newName: "IX_Companies_Status",
                table: "Clients");

            migrationBuilder.RenameIndex(
                name: "IX_Clients_UpdatedAt",
                newName: "IX_Companies_UpdatedAt",
                table: "Clients");

            migrationBuilder.RenameIndex(
                name: "IX_Clients_Name",
                newName: "IX_Companies_Name",
                table: "Clients");

            migrationBuilder.RenameTable(
                name: "Clients",
                newName: "Companies");

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

            migrationBuilder.RenameTable(
                name: "Companies",
                newName: "Clients");

            migrationBuilder.RenameIndex(
                name: "IX_Companies_Status",
                newName: "IX_Clients_Status",
                table: "Clients");

            migrationBuilder.RenameIndex(
                name: "IX_Companies_UpdatedAt",
                newName: "IX_Clients_UpdatedAt",
                table: "Clients");

            migrationBuilder.RenameIndex(
                name: "IX_Companies_Name",
                newName: "IX_Clients_Name",
                table: "Clients");
        }
    }
}
