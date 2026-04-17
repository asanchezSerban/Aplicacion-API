using ClientManager.API.Data;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Services;

public class CompanyService : ICompanyService
{
    private static readonly HashSet<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    private static readonly HashSet<string> AllowedMimeTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp"
    ];
    private const long MaxLogoSize = 5 * 1024 * 1024; // 5 MB

    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<CompanyService> _logger;

    public CompanyService(
        ApplicationDbContext db,
        IWebHostEnvironment env,
        IHttpContextAccessor httpContextAccessor,
        ILogger<CompanyService> logger)
    {
        _db = db;
        _env = env;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task<PagedResponseDto<CompanyResponseDto>> GetAllAsync(int page, int pageSize, string? name)
    {
        var query = _db.Companies.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(c => c.Name.ToLower().Contains(name.ToLower()));
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var companies = await query
            .OrderByDescending(c => c.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponseDto<CompanyResponseDto>
        {
            Data = companies.Select(MapToDto),
            TotalItems = totalItems,
            TotalPages = totalPages,
            CurrentPage = page,
            PageSize = pageSize
        };
    }

    public async Task<CompanyResponseDto> GetByIdAsync(int id)
    {
        var company = await _db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException($"Empresa con ID {id} no encontrada.");

        return MapToDto(company);
    }

    public async Task<CompanyResponseDto> CreateAsync(CreateCompanyDto dto, IFormFile? logo)
    {
        var sanitizedName = SanitizeInput(dto.Name);

        if (await _db.Companies.AnyAsync(c => c.Name.ToLower() == sanitizedName.ToLower()))
            throw new ArgumentException($"Ya existe una empresa con el nombre '{sanitizedName}'.");

        var company = new Company
        {
            Name = sanitizedName,
            Description = SanitizeInput(dto.Description),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (logo is not null && logo.Length > 0)
        {
            company.LogoFileName = await SaveLogoAsync(logo);
        }

        _db.Companies.Add(company);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Empresa creada con ID {CompanyId}", company.Id);

        return MapToDto(company);
    }

    public async Task<CompanyResponseDto> UpdateAsync(int id, UpdateCompanyDto dto, IFormFile? logo)
    {
        var company = await _db.Companies.FindAsync(id)
            ?? throw new KeyNotFoundException($"Empresa con ID {id} no encontrada.");

        var sanitizedName = SanitizeInput(dto.Name);

        if (await _db.Companies.AnyAsync(c => c.Name.ToLower() == sanitizedName.ToLower() && c.Id != id))
            throw new ArgumentException($"Ya existe una empresa con el nombre '{sanitizedName}'.");

        company.Name = sanitizedName;
        company.Description = SanitizeInput(dto.Description);
        company.UpdatedAt = DateTime.UtcNow;

        if (logo is not null && logo.Length > 0)
        {
            DeleteLogoFile(company.LogoFileName);
            company.LogoFileName = await SaveLogoAsync(logo);
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Empresa {CompanyId} actualizada", company.Id);

        return MapToDto(company);
    }

    public async Task DeleteAsync(int id)
    {
        var company = await _db.Companies.FindAsync(id)
            ?? throw new KeyNotFoundException($"Empresa con ID {id} no encontrada.");

        DeleteLogoFile(company.LogoFileName);

        _db.Companies.Remove(company);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Empresa {CompanyId} eliminada", company.Id);
    }

    private CompanyResponseDto MapToDto(Company company)
    {
        return new CompanyResponseDto
        {
            Id = company.Id,
            Name = company.Name,
            Description = company.Description,
            LogoUrl = BuildLogoUrl(company.LogoFileName),
            CreatedAt = company.CreatedAt,
            UpdatedAt = company.UpdatedAt
        };
    }

    private string? BuildLogoUrl(string? logoFileName)
    {
        if (string.IsNullOrEmpty(logoFileName)) return null;

        var request = _httpContextAccessor.HttpContext?.Request;
        if (request is null) return null;

        return $"{request.Scheme}://{request.Host}/uploads/{logoFileName}";
    }

    private async Task<string> SaveLogoAsync(IFormFile file)
    {
        if (file.Length > MaxLogoSize)
            throw new ArgumentException("El archivo de logo no puede superar los 5 MB.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            throw new ArgumentException($"Formato de archivo no permitido. Formatos válidos: {string.Join(", ", AllowedExtensions)}");

        if (!AllowedMimeTypes.Contains(file.ContentType.ToLowerInvariant()))
            throw new ArgumentException("El tipo MIME del archivo no es válido para una imagen.");

        // Leer los primeros bytes del fichero real para verificar su firma (magic bytes).
        // La extensión y el Content-Type los controla el cliente y se pueden falsificar;
        // la firma binaria del contenido no.
        await using var readStream = file.OpenReadStream();
        var header = new byte[12];
        await readStream.ReadAsync(header.AsMemory(0, 12));

        if (!HasValidMagicBytes(header, extension))
            throw new ArgumentException("El contenido del archivo no coincide con el formato de imagen declarado.");

        var uploadsPath = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadsPath);

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadsPath, fileName);

        readStream.Position = 0; // volver al inicio antes de copiar
        await using var fileStream = new FileStream(filePath, FileMode.Create);
        await readStream.CopyToAsync(fileStream);

        return fileName;
    }

    /// <summary>
    /// Comprueba los primeros bytes del fichero contra las firmas conocidas de cada formato.
    /// JPEG: FF D8 FF | PNG: 89 50 4E 47 | GIF: 47 49 46 38 | WebP: RIFF....WEBP
    /// </summary>
    private static bool HasValidMagicBytes(byte[] h, string extension) => extension switch
    {
        ".jpg" or ".jpeg" => h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF,
        ".png"  => h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47,
        ".gif"  => h[0] == 0x47 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x38,
        ".webp" => h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46
                && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50,
        _ => false
    };

    private void DeleteLogoFile(string? logoFileName)
    {
        if (string.IsNullOrEmpty(logoFileName)) return;

        var filePath = Path.Combine(_env.WebRootPath, "uploads", logoFileName);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger.LogInformation("Archivo de logo eliminado: {FileName}", logoFileName);
        }
    }

    private static string SanitizeInput(string input)
    {
        return System.Net.WebUtility.HtmlEncode(input.Trim());
    }
}
