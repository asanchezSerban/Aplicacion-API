using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClientManager.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTotpBackupCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TotpBackupCodes",
                table: "AspNetUsers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotpBackupCodes",
                table: "AspNetUsers");
        }
    }
}
