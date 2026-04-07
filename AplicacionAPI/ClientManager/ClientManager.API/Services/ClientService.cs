using ClientManager.API.Data;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Services;

public class ClientService : IClientService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ClientService> _logger;

    public ClientService(ApplicationDbContext db, ILogger<ClientService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<PagedResponseDto<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? name, int? companyId)
    {
        var query = _db.Clients.AsNoTracking().Include(c => c.Company).AsQueryable();

        if (!string.IsNullOrWhiteSpace(name))
            query = query.Where(c => c.Name.ToLower().Contains(name.ToLower()));

        if (companyId.HasValue)
            query = query.Where(c => c.CompanyId == companyId.Value);

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
        var client = await _db.Clients.AsNoTracking().Include(c => c.Company).FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        return MapToDto(client);
    }

    public async Task<ClientResponseDto> CreateAsync(CreateClientDto dto)
    {
        var companyExists = await _db.Companies.AnyAsync(c => c.Id == dto.CompanyId);
        if (!companyExists)
            throw new ArgumentException($"La empresa con ID {dto.CompanyId} no existe.");

        var client = new Client
        {
            Name = dto.Name.Trim(),
            Email = dto.Email.Trim().ToLowerInvariant(),
            CompanyId = dto.CompanyId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Clients.Add(client);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Cliente creado con ID {ClientId}", client.Id);

        await _db.Entry(client).Reference(c => c.Company).LoadAsync();
        return MapToDto(client);
    }

    public async Task<ClientResponseDto> UpdateAsync(int id, UpdateClientDto dto)
    {
        var client = await _db.Clients.Include(c => c.Company).FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == dto.CompanyId);
        if (!companyExists)
            throw new ArgumentException($"La empresa con ID {dto.CompanyId} no existe.");

        client.Name = dto.Name.Trim();
        client.Email = dto.Email.Trim().ToLowerInvariant();
        client.CompanyId = dto.CompanyId;
        client.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Cliente {ClientId} actualizado", client.Id);

        await _db.Entry(client).Reference(c => c.Company).LoadAsync();
        return MapToDto(client);
    }

    public async Task DeleteAsync(int id)
    {
        var client = await _db.Clients.FindAsync(id)
            ?? throw new KeyNotFoundException($"Cliente con ID {id} no encontrado.");

        _db.Clients.Remove(client);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Cliente {ClientId} eliminado", client.Id);
    }

    private static ClientResponseDto MapToDto(Client client) => new()
    {
        Id = client.Id,
        Name = client.Name,
        Email = client.Email,
        CompanyId = client.CompanyId,
        CompanyName = client.Company?.Name ?? string.Empty,
        CreatedAt = client.CreatedAt,
        UpdatedAt = client.UpdatedAt
    };
}
