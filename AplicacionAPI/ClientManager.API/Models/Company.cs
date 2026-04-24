using System.ComponentModel.DataAnnotations;

namespace ClientManager.API.Models;

public enum CompanyStatus { Prospect, Active, Inactive, Churned }

public class Company
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? LogoFileName { get; set; }

    public CompanyStatus Status { get; set; } = CompanyStatus.Active;

    [MaxLength(200)]
    public string? ContactEmail { get; set; }

    [MaxLength(30)]
    public string? ContactPhone { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = [];
}
