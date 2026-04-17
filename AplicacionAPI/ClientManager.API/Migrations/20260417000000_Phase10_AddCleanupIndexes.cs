using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClientManager.API.Migrations
{
    /// <inheritdoc />
    public partial class Phase10_AddCleanupIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Índice en ExpiresAt para acelerar la purga periódica de OTPs
            migrationBuilder.CreateIndex(
                name: "IX_EmailOtpCodes_ExpiresAt",
                table: "EmailOtpCodes",
                column: "ExpiresAt");

            // Índice compuesto para la consulta "OTPs expirados o usados"
            migrationBuilder.CreateIndex(
                name: "IX_EmailOtpCodes_ExpiresAt_IsUsed",
                table: "EmailOtpCodes",
                columns: new[] { "ExpiresAt", "IsUsed" });

            // Índice en ExpiresAt para acelerar la purga periódica de refresh tokens
            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmailOtpCodes_ExpiresAt",
                table: "EmailOtpCodes");

            migrationBuilder.DropIndex(
                name: "IX_EmailOtpCodes_ExpiresAt_IsUsed",
                table: "EmailOtpCodes");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens");
        }
    }
}
