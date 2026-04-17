using ClientManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<User> CompanyUsers => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<EmailOtpCode> EmailOtpCodes => Set<EmailOtpCode>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // MUST be first: IdentityDbContext configures all 7 AspNet* tables here
        base.OnModelCreating(modelBuilder);

        // ── ApplicationUser ───────────────────────────────────────
        var appUser = modelBuilder.Entity<ApplicationUser>();
        appUser.HasIndex(u => u.UserId);
        appUser.HasOne(u => u.User)
            .WithMany()
            .HasForeignKey(u => u.UserId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        // ── Company ──────────────────────────────────────────────
        var company = modelBuilder.Entity<Company>();

        company.ToTable("Companies");
        company.HasKey(c => c.Id);
        company.Property(c => c.Id).UseIdentityAlwaysColumn();
        company.Property(c => c.Name).HasMaxLength(200).IsRequired();
        company.Property(c => c.Description).HasMaxLength(2000).IsRequired();
        company.Property(c => c.LogoFileName).HasMaxLength(500);
        company.Property(c => c.CreatedAt).HasDefaultValueSql("NOW()");
        company.Property(c => c.UpdatedAt).HasDefaultValueSql("NOW()");
        company.HasIndex(c => c.UpdatedAt);
        company.HasIndex(c => c.Name).IsUnique();

        company.HasData(
            new Company
            {
                Id = 1,
                Name = "Acme Corp",
                Description = "Empresa principal del sector industrial",
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Company
            {
                Id = 2,
                Name = "Tech Startup SL",
                Description = "Startup tecnológica en fase de evaluación",
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // ── User ─────────────────────────────────────────────────
        var user = modelBuilder.Entity<User>();

        user.ToTable("Users");
        user.HasKey(u => u.Id);
        user.Property(u => u.Id).UseIdentityAlwaysColumn();
        user.Property(u => u.Name).HasMaxLength(200).IsRequired();
        user.Property(u => u.Email).HasMaxLength(200).IsRequired();
        user.Property(u => u.CreatedAt).HasDefaultValueSql("NOW()");
        user.Property(u => u.UpdatedAt).HasDefaultValueSql("NOW()");
        user.HasIndex(u => u.Name);
        user.HasIndex(u => u.CompanyId);
        user.HasIndex(u => u.Email).IsUnique();

        user.HasOne(u => u.Company)
            .WithMany(c => c.Users)
            .HasForeignKey(u => u.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── EmailOtpCode ─────────────────────────────────────────
        var otp = modelBuilder.Entity<EmailOtpCode>();

        otp.ToTable("EmailOtpCodes");
        otp.HasKey(o => o.Id);
        otp.Property(o => o.Id).UseIdentityAlwaysColumn();
        otp.Property(o => o.UserId).IsRequired();
        otp.Property(o => o.CodeHash).HasMaxLength(64).IsRequired();
        otp.HasIndex(o => o.UserId);
        otp.HasIndex(o => o.ExpiresAt);          // limpieza periódica
        otp.HasIndex(o => new { o.ExpiresAt, o.IsUsed }); // filtro compuesto en purge
        otp.HasOne(o => o.User)
            .WithMany()
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── RefreshToken ─────────────────────────────────────────
        var refreshToken = modelBuilder.Entity<RefreshToken>();

        refreshToken.ToTable("RefreshTokens");
        refreshToken.HasKey(r => r.Id);
        refreshToken.Property(r => r.Id).UseIdentityAlwaysColumn();
        refreshToken.Property(r => r.Token).HasMaxLength(200).IsRequired();
        refreshToken.Property(r => r.UserId).IsRequired();
        refreshToken.Property(r => r.ReplacedByToken).HasMaxLength(200);
        refreshToken.HasIndex(r => r.Token).IsUnique();
        refreshToken.HasIndex(r => r.UserId);
        refreshToken.HasIndex(r => r.ExpiresAt);  // limpieza periódica
        refreshToken.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
