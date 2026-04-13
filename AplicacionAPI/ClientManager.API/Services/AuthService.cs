using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClientManager.API.Data;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ClientManager.API.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly ApplicationDbContext _db;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<AuthService> logger,
        ApplicationDbContext db)
    {
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
        _db = db;
    }

    public async Task<TokenResponseDto> LoginAsync(LoginDto dto)
    {
        const string invalidCredentialsMessage = "Credenciales inválidas.";

        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
            throw new UnauthorizedAccessException(invalidCredentialsMessage);

        if (await _userManager.IsLockedOutAsync(user))
            throw new UnauthorizedAccessException("Cuenta bloqueada temporalmente. Intente de nuevo más tarde.");

        var passwordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!passwordValid)
        {
            await _userManager.AccessFailedAsync(user);
            _logger.LogWarning("Intento de login fallido para {Email}", dto.Email);
            throw new UnauthorizedAccessException(invalidCredentialsMessage);
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? string.Empty;

        var accessToken = GenerateAccessToken(user, role, out var expiresAt);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        _logger.LogInformation("Login correcto para {Email} con rol {Role}", dto.Email, role);

        return new TokenResponseDto
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt    = expiresAt,
            UserEmail    = user.Email!,
            Role         = role
        };
    }

    public async Task<TokenResponseDto> RefreshAsync(string refreshToken)
    {
        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == refreshToken);

        if (stored is null || !stored.IsActive)
            throw new UnauthorizedAccessException("Refresh token inválido o expirado.");

        var user = stored.User;
        var roles = await _userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? string.Empty;

        var newAccessToken  = GenerateAccessToken(user, role, out var expiresAt);
        var newRefreshToken = await CreateRefreshTokenAsync(user.Id);

        // Revocar el token antiguo y registrar cuál lo reemplaza
        stored.RevokedAt        = DateTime.UtcNow;
        stored.ReplacedByToken  = newRefreshToken.Token;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Refresh token rotado para {Email}", user.Email);

        return new TokenResponseDto
        {
            AccessToken  = newAccessToken,
            RefreshToken = newRefreshToken.Token,
            ExpiresAt    = expiresAt,
            UserEmail    = user.Email!,
            Role         = role
        };
    }

    public async Task RevokeAsync(string refreshToken)
    {
        var stored = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == refreshToken);

        if (stored is null || !stored.IsActive)
            throw new UnauthorizedAccessException("Refresh token inválido o ya revocado.");

        stored.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Refresh token revocado (logout)");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private string GenerateAccessToken(ApplicationUser user, string role, out DateTime expiresAt)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("role",            role)
        };

        if (role == "Cliente" && user.UserId.HasValue)
            claims.Add(new Claim("userId", user.UserId.Value.ToString()));

        var secretKey     = _configuration["Jwt:SecretKey"]       ?? throw new InvalidOperationException("Jwt:SecretKey no configurado.");
        var issuer        = _configuration["Jwt:Issuer"]          ?? "ClientManagerAPI";
        var audience      = _configuration["Jwt:Audience"]        ?? "ClientManagerApp";
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryInMinutes"] ?? "15");

        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var token = new JwtSecurityToken(
            issuer:             issuer,
            audience:           audience,
            claims:             claims,
            expires:            expiresAt,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<RefreshToken> CreateRefreshTokenAsync(string userId)
    {
        var refreshToken = new RefreshToken
        {
            Token     = Guid.NewGuid().ToString(),
            UserId    = userId,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();

        return refreshToken;
    }
}
