using System.ComponentModel.DataAnnotations;
using ClientManager.API.Models;

namespace ClientManager.API.DTOs;

public class CreateCompanyDto
{
    [Required]
    [StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(2000, MinimumLength = 10)]
    public string Description { get; set; } = string.Empty;

    public CompanyStatus Status { get; set; } = CompanyStatus.Active;

    [EmailAddress]
    [StringLength(200)]
    public string? ContactEmail { get; set; }

    [Phone]
    [StringLength(30)]
    public string? ContactPhone { get; set; }
}

public class UpdateCompanyDto
{
    [Required]
    [StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(2000, MinimumLength = 10)]
    public string Description { get; set; } = string.Empty;

    public CompanyStatus Status { get; set; } = CompanyStatus.Active;

    [EmailAddress]
    [StringLength(200)]
    public string? ContactEmail { get; set; }

    [Phone]
    [StringLength(30)]
    public string? ContactPhone { get; set; }
}

public class CompanyResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public CompanyStatus Status { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int UsersCount { get; set; }
}

public class PagedResponseDto<T>
{
    public IEnumerable<T> Data { get; set; } = [];
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
}
