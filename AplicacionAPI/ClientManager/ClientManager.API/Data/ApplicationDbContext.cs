using ClientManager.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Client> Clients => Set<Client>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var entity = modelBuilder.Entity<Client>();

        entity.ToTable("Clients");

        entity.HasKey(c => c.Id);

        entity.Property(c => c.Id)
            .UseIdentityAlwaysColumn();

        entity.Property(c => c.Name)
            .HasMaxLength(200)
            .IsRequired();

        entity.Property(c => c.Description)
            .HasMaxLength(2000)
            .IsRequired();

        entity.Property(c => c.LogoFileName)
            .HasMaxLength(500);

        entity.Property(c => c.Status)
            .HasMaxLength(50)
            .HasConversion<string>()
            .IsRequired();

        entity.Property(c => c.CreatedAt)
            .HasDefaultValueSql("NOW()");

        entity.Property(c => c.UpdatedAt)
            .HasDefaultValueSql("NOW()");

        entity.HasIndex(c => c.Status);
        entity.HasIndex(c => c.UpdatedAt);
        entity.HasIndex(c => c.Name);

        entity.HasData(
            new Client
            {
                Id = 1,
                Name = "Acme Corp",
                Description = "Cliente principal del sector industrial",
                Status = ClientStatus.Active,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Client
            {
                Id = 2,
                Name = "Tech Startup SL",
                Description = "Startup tecnológica en fase de evaluación",
                Status = ClientStatus.Prospect,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
