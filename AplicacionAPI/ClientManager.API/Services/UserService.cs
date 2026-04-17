using ClientManager.API.Data;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<UserService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;

    public UserService(ApplicationDbContext db, ILogger<UserService> logger, UserManager<ApplicationUser> userManager)
    {
        _db          = db;
        _logger      = logger;
        _userManager = userManager;
    }

    public async Task<PagedResponseDto<UserResponseDto>> GetAllAsync(int page, int pageSize, string? name, int? companyId, CancellationToken ct = default)
    {
        var query = _db.CompanyUsers.AsNoTracking().Include(u => u.Company).AsQueryable();

        if (!string.IsNullOrWhiteSpace(name))
            query = query.Where(u => u.Name.ToLower().Contains(name.ToLower()));

        if (companyId.HasValue)
            query = query.Where(u => u.CompanyId == companyId.Value);

        var totalItems = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResponseDto<UserResponseDto>
        {
            Data       = users.Select(MapToDto),
            TotalItems = totalItems,
            TotalPages = totalPages,
            CurrentPage = page,
            PageSize   = pageSize
        };
    }

    public async Task<UserResponseDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var user = await _db.CompanyUsers.AsNoTracking().Include(u => u.Company).FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException($"Usuario con ID {id} no encontrado.");

        return MapToDto(user);
    }

    public async Task<UserResponseDto> CreateAsync(CreateUserDto dto, CancellationToken ct = default)
    {
        var companyExists = await _db.Companies.AnyAsync(c => c.Id == dto.CompanyId, ct);
        if (!companyExists)
            throw new ArgumentException($"La empresa con ID {dto.CompanyId} no existe.");

        var email = dto.Email.Trim().ToLowerInvariant();

        // Abrir transacción: si no se llama CommitAsync, el await using la revierte
        // automáticamente al salir del bloque, sin importar la causa del fallo.
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // Paso 1 — crear la entidad de negocio
        var user = new User
        {
            Name      = dto.Name.Trim(),
            Email     = email,
            CompanyId = dto.CompanyId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.CompanyUsers.Add(user);
        await _db.SaveChangesAsync(ct); // dentro de la transacción — aún no confirmado en BD

        // Paso 2 — crear la cuenta de acceso vinculada al User recién creado
        var appUser = new ApplicationUser
        {
            UserName       = email,
            Email          = email,
            EmailConfirmed = true,
            UserId         = user.Id,  // disponible porque SaveChanges generó el ID
            CreatedAt      = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(appUser, dto.Password);
        if (!result.Succeeded)
        {
            // Al salir sin CommitAsync, await using revierte automáticamente el Paso 1
            var mensajes = result.Errors.Select(e => e.Code switch
            {
                "PasswordTooShort"                => "Mínimo 8 caracteres.",
                "PasswordRequiresNonAlphanumeric" => "Debe incluir al menos un carácter especial (!@#$...).",
                "PasswordRequiresDigit"           => "Debe incluir al menos un número.",
                "PasswordRequiresLower"           => "Debe incluir al menos una letra minúscula.",
                "PasswordRequiresUpper"           => "Debe incluir al menos una letra mayúscula.",
                "DuplicateEmail"                  => "Ya existe una cuenta con ese email.",
                "DuplicateUserName"               => "Ya existe una cuenta con ese email.",
                _                                 => e.Description
            });
            throw new ArgumentException(string.Join(" ", mensajes));
        }

        // Paso 3 — asignar rol
        await _userManager.AddToRoleAsync(appUser, "Cliente");

        // Todo correcto — confirmar los tres pasos de golpe en la BD
        await tx.CommitAsync(ct);

        _logger.LogInformation("Usuario creado con ID {UserId} y cuenta de acceso vinculada", user.Id);

        await _db.Entry(user).Reference(u => u.Company).LoadAsync(ct);
        return MapToDto(user);
    }

    public async Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto, CancellationToken ct = default)
    {
        var user = await _db.CompanyUsers.Include(u => u.Company).FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException($"Usuario con ID {id} no encontrado.");

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == dto.CompanyId, ct);
        if (!companyExists)
            throw new ArgumentException($"La empresa con ID {dto.CompanyId} no existe.");

        user.Name      = dto.Name.Trim();
        user.Email     = dto.Email.Trim().ToLowerInvariant();
        user.CompanyId = dto.CompanyId;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Usuario {UserId} actualizado", user.Id);

        await _db.Entry(user).Reference(u => u.Company).LoadAsync(ct);
        return MapToDto(user);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var user = await _db.CompanyUsers.FindAsync(new object?[] { id }, ct)
            ?? throw new KeyNotFoundException($"Usuario con ID {id} no encontrado.");

        _db.CompanyUsers.Remove(user);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Usuario {UserId} eliminado", user.Id);
    }

    private static UserResponseDto MapToDto(User user) => new()
    {
        Id          = user.Id,
        Name        = user.Name,
        Email       = user.Email,
        CompanyId   = user.CompanyId,
        CompanyName = user.Company?.Name ?? string.Empty,
        CreatedAt   = user.CreatedAt,
        UpdatedAt   = user.UpdatedAt
    };
}
