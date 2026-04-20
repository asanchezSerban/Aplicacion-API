using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ClientManager.API.Data;
using ClientManager.API.DTOs;
using ClientManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OtpNet;

namespace ClientManager.API.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly ApplicationDbContext _db;
    private readonly IEmailService _emailService;
    private readonly IHostEnvironment _env;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<AuthService> logger,
        ApplicationDbContext db,
        IEmailService emailService,
        IHostEnvironment env)
    {
        _userManager   = userManager;
        _configuration = configuration;
        _logger        = logger;
        _db            = db;
        _emailService  = emailService;
        _env           = env;
    }

    public async Task<LoginResponseDto> LoginAsync(LoginDto dto)
    {
        const string invalidCredentialsMessage = "Credenciales inválidas.";

        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
            throw new UnauthorizedAccessException(invalidCredentialsMessage);

        if (await _userManager.IsLockedOutAsync(user))
        {
            _logger.LogWarning("Login bloqueado para {Email} — cuenta en lockout", dto.Email);
            throw new AccountLockedException("Cuenta bloqueada.");
        }

        var passwordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!passwordValid)
        {
            await _userManager.AccessFailedAsync(user);
            _logger.LogWarning("Intento de login fallido para {Email}", dto.Email);
            throw new UnauthorizedAccessException(invalidCredentialsMessage);
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        var isSuperAdmin = (await _userManager.GetRolesAsync(user)).Contains("SuperAdmin");

        if (isSuperAdmin && user.TotpEnabled)
        {
            // TOTP configurado → el admin debe verificar con Google Authenticator
            return new LoginResponseDto { RequiresMfa = true, MfaEmail = user.Email, MfaType = "totp" };
        }

        if (isSuperAdmin && !user.TotpEnabled)
        {
            // TOTP aún no configurado → emitir tokens para que el admin pueda acceder a /configurar-totp
            // El guard del frontend (adminGuard) bloqueará el resto de páginas hasta que lo active.
            var at = GenerateAccessToken(user, "SuperAdmin", out var exp);
            var rt = await CreateRefreshTokenAsync(user.Id);
            _logger.LogInformation("SuperAdmin {Email} sin TOTP — redirigiendo a configuración", user.Email);
            return new LoginResponseDto
            {
                RequiresMfa  = false,
                AccessToken  = at,
                RefreshToken = rt.Token,
                ExpiresAt    = exp,
                Email        = user.Email!,
                Role         = "SuperAdmin",
                TotpEnabled  = user.TotpEnabled
            };
        }

        // Invalidar OTPs anteriores activos del mismo usuario
        var previousOtps = await _db.EmailOtpCodes
            .Where(o => o.UserId == user.Id && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var old in previousOtps)
            old.IsUsed = true;

        // Generar OTP de 6 dígitos
        var bytes = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        var code      = (Math.Abs(BitConverter.ToInt32(bytes, 0)) % 1_000_000).ToString("D6");
        var codeHash  = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
        var expiresAt = DateTime.UtcNow.AddMinutes(1);

        _db.EmailOtpCodes.Add(new EmailOtpCode
        {
            UserId    = user.Id,
            CodeHash  = codeHash,
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        if (_env.IsDevelopment())
            DevOtpStore.Set(user.Email!, code);

        // Enviar email con el código
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#1a1a2e">Verificación de acceso</h2>
              <p>Tu código de verificación para <strong>ClientManager</strong> es:</p>
              <div style="font-size:2.5rem;font-weight:700;letter-spacing:0.5rem;
                          text-align:center;padding:1.5rem;margin:1rem 0;
                          background:#f0f4ff;border-radius:12px;color:#1a1a2e">
                {code}
              </div>
              <p>Este código expira en <strong>1 minuto</strong>.</p>
              <p style="color:#888;font-size:0.85rem">Si no intentaste iniciar sesión, ignora este email.</p>
            </div>
            """;

        await _emailService.SendAsync(user.Email!, user.UserName!, "Código de verificación — ClientManager", html);
        _logger.LogInformation("OTP enviado para {Email}", user.Email);

        return new LoginResponseDto { RequiresMfa = true, MfaEmail = user.Email, MfaType = "email", OtpExpiresAt = expiresAt };
    }

    public async Task<DateTime> ResendOtpAsync(string email)
    {
        // Calcular el TTL antes de cualquier comprobación — anti-enumeración:
        // siempre devolvemos un expiresAt real aunque el email no exista.
        var expiresAt = DateTime.UtcNow.AddMinutes(1);

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null) return expiresAt;

        // SuperAdmin usa TOTP, no Email OTP — no tiene sentido reenviar
        var isSuperAdmin = (await _userManager.GetRolesAsync(user)).Contains("SuperAdmin");
        if (isSuperAdmin) return expiresAt;

        // Invalidar OTPs anteriores activos
        var previousOtps = await _db.EmailOtpCodes
            .Where(o => o.UserId == user.Id && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var old in previousOtps)
            old.IsUsed = true;

        // Generar nuevo OTP
        var bytes    = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        var code     = (Math.Abs(BitConverter.ToInt32(bytes, 0)) % 1_000_000).ToString("D6");
        var codeHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

        _db.EmailOtpCodes.Add(new EmailOtpCode
        {
            UserId    = user.Id,
            CodeHash  = codeHash,
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        if (_env.IsDevelopment())
            DevOtpStore.Set(user.Email!, code);

        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#1a1a2e">Verificación de acceso</h2>
              <p>Tu nuevo código de verificación para <strong>ClientManager</strong> es:</p>
              <div style="font-size:2.5rem;font-weight:700;letter-spacing:0.5rem;
                          text-align:center;padding:1.5rem;margin:1rem 0;
                          background:#f0f4ff;border-radius:12px;color:#1a1a2e">
                {code}
              </div>
              <p>Este código expira en <strong>1 minuto</strong>.</p>
              <p style="color:#888;font-size:0.85rem">Si no intentaste iniciar sesión, ignora este email.</p>
            </div>
            """;

        await _emailService.SendAsync(user.Email!, user.UserName!, "Nuevo código de verificación — ClientManager", html);
        _logger.LogInformation("OTP reenviado para {Email}", user.Email);
        return expiresAt;
    }

    public async Task<TokenResponseDto> MfaVerifyAsync(MfaVerifyDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email)
            ?? throw new UnauthorizedAccessException("Credenciales inválidas.");

        if (user.TotpEnabled)
        {
            // ── Verificación TOTP (Google Authenticator) ─────────────────────
            if (string.IsNullOrEmpty(user.TotpSecret))
                throw new UnauthorizedAccessException("TOTP no configurado correctamente.");

            var totp  = new Totp(Base32Encoding.ToBytes(user.TotpSecret));
            var valid = totp.VerifyTotp(DateTime.UtcNow, dto.Code, out _, VerificationWindow.RfcSpecifiedNetworkDelay);
            if (!valid)
                throw new UnauthorizedAccessException("Código incorrecto. Verifica que tu app esté sincronizada.");
        }
        else
        {
            // ── Verificación Email OTP ────────────────────────────────────────
            var otp = await _db.EmailOtpCodes
                .Where(o => o.UserId == user.Id && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync()
                ?? throw new UnauthorizedAccessException("El código ha expirado. Inicia sesión de nuevo.");

            if (otp.Attempts >= 3)
            {
                otp.IsUsed = true;
                await _db.SaveChangesAsync();
                throw new UnauthorizedAccessException("Demasiados intentos. Inicia sesión de nuevo.");
            }

            var codeHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(dto.Code)));
            if (otp.CodeHash != codeHash)
            {
                otp.Attempts++;
                await _db.SaveChangesAsync();
                var remaining = 3 - otp.Attempts;
                throw new UnauthorizedAccessException(
                    remaining > 0
                        ? $"Código incorrecto. Te quedan {remaining} intento{(remaining == 1 ? "" : "s")}."
                        : "Demasiados intentos. Inicia sesión de nuevo.");
            }

            otp.IsUsed = true;
            await _db.SaveChangesAsync();
        }

        var roles = await _userManager.GetRolesAsync(user);
        var role  = roles.FirstOrDefault() ?? string.Empty;

        var accessToken  = GenerateAccessToken(user, role, out var expiresAt);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        _logger.LogInformation("{MfaType} verificado correctamente para {Email}",
            user.TotpEnabled ? "TOTP" : "Email OTP", user.Email);

        return new TokenResponseDto
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt    = expiresAt,
            UserEmail    = user.Email!,
            Role         = role,
            TotpEnabled  = user.TotpEnabled
        };
    }

    // ── TOTP ─────────────────────────────────────────────────────────────────

    public async Task<TotpStatusDto> TotpStatusAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");
        return new TotpStatusDto { Enabled = user.TotpEnabled };
    }

    public async Task<TotpSetupResponseDto> TotpSetupAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        // Generar semilla aleatoria de 160 bits (estándar TOTP)
        var secretBytes = KeyGeneration.GenerateRandomKey(20);
        var secret      = Base32Encoding.ToString(secretBytes);

        // Guardar la semilla (aún no activada — TotpEnabled sigue false hasta confirmar)
        user.TotpSecret = secret;
        await _userManager.UpdateAsync(user);

        var label  = Uri.EscapeDataString(user.Email!);
        var issuer = Uri.EscapeDataString("ClientManager");
        var qrUri  = $"otpauth://totp/{issuer}:{label}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30";

        _logger.LogInformation("TOTP setup iniciado para {Email}", user.Email);

        return new TotpSetupResponseDto { QrUri = qrUri, Secret = secret };
    }

    public async Task<TokenResponseDto> TotpConfirmAsync(string userId, string code)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        if (string.IsNullOrEmpty(user.TotpSecret))
            throw new InvalidOperationException("Inicia el setup de TOTP antes de confirmar.");

        var totp  = new Totp(Base32Encoding.ToBytes(user.TotpSecret));
        var valid = totp.VerifyTotp(DateTime.UtcNow, code, out _, VerificationWindow.RfcSpecifiedNetworkDelay);
        if (!valid)
            throw new ArgumentException("Código incorrecto. Asegúrate de haber escaneado el QR y de que la hora del dispositivo sea correcta.");

        user.TotpEnabled = true;
        await _userManager.UpdateAsync(user);

        // Emitir nuevos tokens con totpEnabled=true en el claim para que el guard lo refleje de inmediato
        var roles        = await _userManager.GetRolesAsync(user);
        var role         = roles.FirstOrDefault() ?? string.Empty;
        var accessToken  = GenerateAccessToken(user, role, out var expiresAt);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        _logger.LogInformation("TOTP activado para {Email}", user.Email);

        return new TokenResponseDto
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt    = expiresAt,
            UserEmail    = user.Email!,
            Role         = role,
            TotpEnabled  = user.TotpEnabled
        };
    }

    public async Task<TokenResponseDto> TotpDisableAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        user.TotpEnabled = false;
        user.TotpSecret  = null;
        await _userManager.UpdateAsync(user);

        // Emitir nuevos tokens con totpEnabled=false para que el guard bloquee inmediatamente
        var roles        = await _userManager.GetRolesAsync(user);
        var role         = roles.FirstOrDefault() ?? string.Empty;
        var accessToken  = GenerateAccessToken(user, role, out var expiresAt);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        _logger.LogInformation("TOTP desactivado para {Email}", user.Email);

        return new TokenResponseDto
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt    = expiresAt,
            UserEmail    = user.Email!,
            Role         = role,
            TotpEnabled  = user.TotpEnabled
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
            Role         = role,
            TotpEnabled  = user.TotpEnabled
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

        if (role == "SuperAdmin")
            claims.Add(new Claim("totpEnabled", user.TotpEnabled.ToString().ToLower()));

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
