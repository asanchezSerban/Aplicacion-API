using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace ClientManager.API.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<TokenResponseDto> LoginAsync(LoginDto dto)
    {
        // Misma respuesta para usuario no encontrado y contraseña incorrecta (evita user enumeration)
        const string invalidCredentialsMessage = "Credenciales inválidas.";

        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
            throw new UnauthorizedAccessException(invalidCredentialsMessage);

        // Comprobar lockout antes de validar contraseña
        if (await _userManager.IsLockedOutAsync(user))
            throw new UnauthorizedAccessException("Cuenta bloqueada temporalmente. Intente de nuevo más tarde.");

        var passwordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!passwordValid)
        {
            await _userManager.AccessFailedAsync(user);
            _logger.LogWarning("Intento de login fallido para {Email}", dto.Email);
            throw new UnauthorizedAccessException(invalidCredentialsMessage);
        }

        // Reset contador de intentos fallidos tras login correcto
        await _userManager.ResetAccessFailedCountAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? string.Empty;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new(ClaimTypes.Role,               role)
        };

        if (role == "Cliente" && user.ClientId.HasValue)
            claims.Add(new Claim("clientId", user.ClientId.Value.ToString()));

        var secretKey      = _configuration["Jwt:SecretKey"]       ?? throw new InvalidOperationException("Jwt:SecretKey no configurado.");
        var issuer         = _configuration["Jwt:Issuer"]          ?? "ClientManagerAPI";
        var audience       = _configuration["Jwt:Audience"]        ?? "ClientManagerApp";
        var expiryMinutes  = int.Parse(_configuration["Jwt:ExpiryInMinutes"] ?? "15");

        var key       = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds     = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var token = new JwtSecurityToken(
            issuer:             issuer,
            audience:           audience,
            claims:             claims,
            expires:            expiresAt,
            signingCredentials: creds
        );

        _logger.LogInformation("Login correcto para {Email} con rol {Role}", dto.Email, role);

        return new TokenResponseDto
        {
            AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt   = expiresAt,
            UserEmail   = user.Email!,
            Role        = role
        };
    }
}
