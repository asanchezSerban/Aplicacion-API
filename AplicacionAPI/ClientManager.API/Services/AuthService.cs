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
    private readonly IEmailService _emailService;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<AuthService> logger,
        ApplicationDbContext db,
        IEmailService emailService)
    {
        _userManager   = userManager;
        _configuration = configuration;
        _logger        = logger;
        _db            = db;
        _emailService  = emailService;
    }

    public async Task<TokenResponseDto> LoginAsync(LoginDto dto)
    {
        const string invalidCredentialsMessage = "Credenciales inválidas.";

        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
            throw new UnauthorizedAccessException(invalidCredentialsMessage);

        if (await _userManager.IsLockedOutAsync(user))
            throw new AccountLockedException("Tu cuenta está bloqueada durante 15 minutos por demasiados intentos fallidos.");

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

    public async Task ForgotPasswordAsync(ForgotPasswordDto dto, string frontendBaseUrl)
    {
        // Siempre devolvemos 200 aunque el email no exista — evita user enumeration
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
        {
            _logger.LogInformation("ForgotPassword solicitado para email no registrado: {Email}", dto.Email);
            return;
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var encodedToken = Uri.EscapeDataString(token);
        var encodedEmail = Uri.EscapeDataString(dto.Email);
        var resetLink = $"{frontendBaseUrl}/reset-password?email={encodedEmail}&token={encodedToken}";

        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#1a1a2e">Recuperar contraseña</h2>
              <p>Has solicitado restablecer tu contraseña en <strong>ClientManager</strong>.</p>
              <p>Haz clic en el siguiente enlace para crear una nueva contraseña. El enlace expira en <strong>1 hora</strong>.</p>
              <a href="{resetLink}"
                 style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f8ef7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
                Restablecer contraseña
              </a>
              <p style="color:#888;font-size:0.85rem">Si no solicitaste este cambio, ignora este email.</p>
            </div>
            """;

        await _emailService.SendAsync(dto.Email, user.UserName!, "Recuperar contraseña — ClientManager", html);
        _logger.LogInformation("Email de recuperación enviado a {Email}", dto.Email);
    }

    public async Task ResetPasswordAsync(ResetPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email)
            ?? throw new ArgumentException("Email no encontrado.");

        var result = await _userManager.ResetPasswordAsync(user, dto.Token, dto.NewPassword);
        if (!result.Succeeded)
        {
            var errorCodes = result.Errors.Select(e => e.Code).ToList();
            _logger.LogWarning("ResetPassword fallido para {Email}: {Errors}", dto.Email, string.Join(", ", errorCodes));

            if (errorCodes.Contains("InvalidToken"))
                throw new ArgumentException("El enlace de recuperación no es válido o ha expirado.");

            var mensajes = result.Errors.Select(e => e.Code switch
            {
                "PasswordTooShort"                => "Mínimo 8 caracteres.",
                "PasswordRequiresNonAlphanumeric" => "Debe incluir al menos un carácter especial (!@#$...).",
                "PasswordRequiresDigit"           => "Debe incluir al menos un número.",
                "PasswordRequiresLower"           => "Debe incluir al menos una letra minúscula.",
                "PasswordRequiresUpper"           => "Debe incluir al menos una letra mayúscula.",
                _                                 => e.Description
            });
            throw new ArgumentException(string.Join(" ", mensajes));
        }

        // Revocar todos los refresh tokens activos al cambiar contraseña
        var activeTokens = _db.RefreshTokens
            .Where(r => r.UserId == user.Id && r.RevokedAt == null && r.ExpiresAt > DateTime.UtcNow);
        await activeTokens.ForEachAsync(t => t.RevokedAt = DateTime.UtcNow);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Contraseña restablecida para {Email}", dto.Email);
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
