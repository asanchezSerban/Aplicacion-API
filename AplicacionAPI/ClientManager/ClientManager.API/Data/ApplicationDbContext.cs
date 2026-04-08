using ClientManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Client> Clients => Set<Client>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // MUST be first: IdentityDbContext configures all 7 AspNet* tables here
        base.OnModelCreating(modelBuilder);

        // ── ApplicationUser ───────────────────────────────────────
        var user = modelBuilder.Entity<ApplicationUser>();
        user.HasIndex(u => u.ClientId);
        user.HasOne(u => u.Client)
            .WithMany()
            .HasForeignKey(u => u.ClientId)
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
        company.Property(c => c.Status).HasMaxLength(50).HasConversion<string>().IsRequired();
        company.Property(c => c.CreatedAt).HasDefaultValueSql("NOW()");
        company.Property(c => c.UpdatedAt).HasDefaultValueSql("NOW()");
        company.HasIndex(c => c.Status);
        company.HasIndex(c => c.UpdatedAt);
        company.HasIndex(c => c.Name);

        company.HasData(
            new Company
            {
                Id = 1,
                Name = "Acme Corp",
                Description = "Empresa principal del sector industrial",
                Status = CompanyStatus.Active,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Company
            {
                Id = 2,
                Name = "Tech Startup SL",
                Description = "Startup tecnológica en fase de evaluación",
                Status = CompanyStatus.Prospect,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // ── Client ───────────────────────────────────────────────
        var client = modelBuilder.Entity<Client>();

        client.ToTable("Clients");
        client.HasKey(c => c.Id);
        client.Property(c => c.Id).UseIdentityAlwaysColumn();
        client.Property(c => c.Name).HasMaxLength(200).IsRequired();
        client.Property(c => c.Email).HasMaxLength(200).IsRequired();
        client.Property(c => c.CreatedAt).HasDefaultValueSql("NOW()");
        client.Property(c => c.UpdatedAt).HasDefaultValueSql("NOW()");
        client.HasIndex(c => c.Name);
        client.HasIndex(c => c.CompanyId);
        client.HasIndex(c => c.Email).IsUnique();

        client.HasOne(c => c.Company)
              .WithMany(co => co.Clients)
              .HasForeignKey(c => c.CompanyId)
              .OnDelete(DeleteBehavior.Cascade);
    }
}
