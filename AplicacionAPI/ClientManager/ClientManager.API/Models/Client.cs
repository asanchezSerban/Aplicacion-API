using System.ComponentModel.DataAnnotations;

namespace ClientManager.API.Models;

public class Client
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

    public ClientStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public enum ClientStatus
{
    Active,
    Inactive,
    Prospect,
    Churned
}
