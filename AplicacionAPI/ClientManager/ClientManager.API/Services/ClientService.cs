using ClientManager.API.Data;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ClientManager.API.Services;

public class ClientService : IClientService
{
    private static readonly HashSet<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    private static readonly HashSet<string> AllowedMimeTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp"
    ];
    private const long MaxLogoSize = 5 * 1024 * 1024; // 5 MB

    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ClientService> _logger;

    public ClientService(
        ApplicationDbContext db,
        IWebHostEnvironment env,
        IHttpContextAccessor httpContextAccessor,
        IMemoryCache cache,
        ILogger<ClientService> logger)
    {
        _db = db;
        _env = env;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _logger = logger;
    }

    public async Task<PagedResponseDto<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? name, string? status)
    {
        var query = _db.Clients.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(c => c.Name.ToLower().Contains(name.ToLower()));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ClientStatus>(status, ignoreCase: true, out var parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var clients = await query
            .OrderByDescending(c => c.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponseDto<ClientResponseDto>
        {
            Data = clients.Select(MapToDto),
            TotalItems = totalItems,
            TotalPages = totalPages,
            CurrentPage = page,
            PageSize = pageSize
        };
    }

    public async Task<ClientResponseDto> GetByIdAsync(int id)
    {
        var client = await _db.Clients.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        return MapToDto(client);
    }

    public async Task<ClientResponseDto> CreateAsync(CreateClientDto dto, IFormFile? logo)
    {
        var client = new Client
        {
            Name = SanitizeInput(dto.Name),
            Description = SanitizeInput(dto.Description),
            Status = dto.Status ?? ClientStatus.Prospect,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (logo is not null && logo.Length > 0)
        {
            client.LogoFileName = await SaveLogoAsync(logo);
        }

        _db.Clients.Add(client);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Cliente creado con ID {ClientId}", client.Id);

        return MapToDto(client);
    }

    public async Task<ClientResponseDto> UpdateAsync(int id, UpdateClientDto dto, IFormFile? logo)
    {
        var client = await _db.Clients.FindAsync(id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        client.Name = SanitizeInput(dto.Name);
        client.Description = SanitizeInput(dto.Description);
        client.Status = dto.Status;
        client.UpdatedAt = DateTime.UtcNow;

        if (logo is not null && logo.Length > 0)
        {
            DeleteLogoFile(client.LogoFileName);
            client.LogoFileName = await SaveLogoAsync(logo);
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Cliente {ClientId} actualizado", client.Id);

        return MapToDto(client);
    }

    public async Task<ClientResponseDto> UpdateStatusAsync(int id, UpdateStatusDto dto)
    {
        var client = await _db.Clients.FindAsync(id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        client.Status = dto.Status;
        client.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Estado del cliente {ClientId} cambiado a {Status}", client.Id, dto.Status);

        return MapToDto(client);
    }

    public async Task DeleteAsync(int id)
    {
        var client = await _db.Clients.FindAsync(id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        DeleteLogoFile(client.LogoFileName);

        _db.Clients.Remove(client);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Cliente {ClientId} eliminado", client.Id);
    }

    private ClientResponseDto MapToDto(Client client)
    {
        return new ClientResponseDto
        {
            Id = client.Id,
            Name = client.Name,
            Description = client.Description,
            LogoUrl = BuildLogoUrl(client.LogoFileName),
            Status = client.Status,
            StatusName = client.Status.ToString(),
            CreatedAt = client.CreatedAt,
            UpdatedAt = client.UpdatedAt
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
        {
            throw new ArgumentException("El archivo de logo no puede superar los 5 MB.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException($"Formato de archivo no permitido. Formatos válidos: {string.Join(", ", AllowedExtensions)}");
        }

        if (!AllowedMimeTypes.Contains(file.ContentType.ToLowerInvariant()))
        {
            throw new ArgumentException("El tipo MIME del archivo no es válido para una imagen.");
        }

        var uploadsPath = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadsPath);

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadsPath, fileName);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        return fileName;
    }

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
