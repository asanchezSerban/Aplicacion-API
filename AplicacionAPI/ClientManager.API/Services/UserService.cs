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

    public async Task<PagedResponseDto<UserResponseDto>> GetAllAsync(int page, int pageSize, string? name, int? companyId)
    {
        var query = _db.CompanyUsers.AsNoTracking().Include(u => u.Company).AsQueryable();

        if (!string.IsNullOrWhiteSpace(name))
            query = query.Where(u => u.Name.ToLower().Contains(name.ToLower()));

        if (companyId.HasValue)
            query = query.Where(u => u.CompanyId == companyId.Value);

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var users = await query
            .OrderByDescending(u => u.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponseDto<UserResponseDto>
        {
            Data       = users.Select(MapToDto),
            TotalItems = totalItems,
            TotalPages = totalPages,
            CurrentPage = page,
            PageSize   = pageSize
        };
    }

    public async Task<UserResponseDto> GetByIdAsync(int id)
    {
        var user = await _db.CompanyUsers.AsNoTracking().Include(u => u.Company).FirstOrDefaultAsync(u => u.Id == id)
            ?? throw new KeyNotFoundException($"Usuario con ID {id} no encontrado.");

        return MapToDto(user);
    }

    public async Task<UserResponseDto> CreateAsync(CreateUserDto dto)
    {
        var companyExists = await _db.Companies.AnyAsync(c => c.Id == dto.CompanyId);
        if (!companyExists)
            throw new ArgumentException($"La empresa con ID {dto.CompanyId} no existe.");

        var email = dto.Email.Trim().ToLowerInvariant();

        // Crear la entidad de negocio
        var user = new User
        {
            Name      = dto.Name.Trim(),
            Email     = email,
            CompanyId = dto.CompanyId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.CompanyUsers.Add(user);
        await _db.SaveChangesAsync();

        // Crear la cuenta de acceso (ApplicationUser) vinculada
        var appUser = new ApplicationUser
        {
            UserName       = email,
            Email          = email,
            EmailConfirmed = true,
            UserId         = user.Id,
            CreatedAt      = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(appUser, dto.Password);
        if (!result.Succeeded)
        {
            // Revertir la creación del usuario de negocio si falla la cuenta
            _db.CompanyUsers.Remove(user);
            await _db.SaveChangesAsync();

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

        await _userManager.AddToRoleAsync(appUser, "Cliente");
        _logger.LogInformation("Usuario creado con ID {UserId} y cuenta de acceso vinculada", user.Id);

        await _db.Entry(user).Reference(u => u.Company).LoadAsync();
        return MapToDto(user);
    }

    public async Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto)
    {
        var user = await _db.CompanyUsers.Include(u => u.Company).FirstOrDefaultAsync(u => u.Id == id)
            ?? throw new KeyNotFoundException($"Usuario con ID {id} no encontrado.");

        var companyExists = await _db.Companies.AnyAsync(c => c.Id == dto.CompanyId);
        if (!companyExists)
            throw new ArgumentException($"La empresa con ID {dto.CompanyId} no existe.");

        user.Name      = dto.Name.Trim();
        user.Email     = dto.Email.Trim().ToLowerInvariant();
        user.CompanyId = dto.CompanyId;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Usuario {UserId} actualizado", user.Id);

        await _db.Entry(user).Reference(u => u.Company).LoadAsync();
        return MapToDto(user);
    }

    public async Task DeleteAsync(int id)
    {
        var user = await _db.CompanyUsers.FindAsync(id)
            ?? throw new KeyNotFoundException($"Usuario con ID {id} no encontrado.");

        _db.CompanyUsers.Remove(user);
        await _db.SaveChangesAsync();

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
