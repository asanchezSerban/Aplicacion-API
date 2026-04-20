using ClientManager.API.DTOs;
using ClientManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ClientManager.API.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly string _frontendBaseUrl;

    public AuthController(IAuthService authService, IConfiguration configuration)
    {
        _authService     = authService;
        _frontendBaseUrl = configuration["Frontend:BaseUrl"] ?? "http://localhost:4200";
    }

    /// <summary>
    /// Verifica credenciales. Devuelve requiresMfa=true si se necesita un segundo factor,
    /// o la identidad del usuario directamente si no hay MFA pendiente.
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _authService.LoginAsync(dto);

        // SuperAdmin sin TOTP configurado: tokens emitidos directamente, van en cookies.
        if (!result.RequiresMfa && result.AccessToken is not null)
        {
            SetAccessTokenCookie(result.AccessToken);
            SetRefreshTokenCookie(result.RefreshToken!);
        }

        return Ok(result);  // AccessToken/RefreshToken ocultos con [JsonIgnore]
    }

    /// <summary>
    /// Devuelve la identidad del usuario autenticado por cookie (para inicialización del cliente).
    /// No está sujeto a rate limiting — es una lectura sin efecto secundario.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [DisableRateLimiting]
    [ProducesResponseType(typeof(IdentityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Me()
    {
        return Ok(new IdentityDto
        {
            Email       = User.FindFirst("email")?.Value      ?? string.Empty,
            Role        = User.FindFirst("role")?.Value       ?? string.Empty,
            TotpEnabled = User.FindFirst("totpEnabled")?.Value == "true",
            UserId      = User.FindFirst("userId")?.Value
        });
    }

    /// <summary>
    /// Verifica el OTP (email o TOTP). Emite tokens en cookies y devuelve la identidad.
    /// </summary>
    [HttpPost("mfa-verify")]
    [ProducesResponseType(typeof(IdentityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> MfaVerify([FromBody] MfaVerifyDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _authService.MfaVerifyAsync(dto);
        return Ok(ApplyTokens(result));
    }

    /// <summary>
    /// Renueva el access token usando el refresh token de la cookie. Devuelve la identidad actualizada.
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(IdentityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized("Refresh token no encontrado.");

        var result = await _authService.RefreshAsync(refreshToken);
        return Ok(ApplyTokens(result));
    }

    /// <summary>
    /// Cierra sesión revocando el refresh token y eliminando ambas cookies.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (!string.IsNullOrEmpty(refreshToken))
            await _authService.RevokeAsync(refreshToken);

        Response.Cookies.Delete("accessToken");
        Response.Cookies.Delete("refreshToken");
        return NoContent();
    }

    /// <summary>
    /// Reenvía el código OTP al email indicado. Siempre devuelve 200 aunque el email no exista.
    /// Invalida el OTP anterior si lo hubiera.
    /// </summary>
    [HttpPost("resend-otp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var otpExpiresAt = await _authService.ResendOtpAsync(dto.Email);
        return Ok(new { message = "Si el email existe y tiene un código pendiente, recibirás uno nuevo.", otpExpiresAt });
    }

    /// <summary>
    /// Envía un email de recuperación de contraseña. Siempre devuelve 200 aunque el email no exista.
    /// </summary>
    [HttpPost("forgot-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        await _authService.ForgotPasswordAsync(dto, _frontendBaseUrl);
        return Ok(new { message = "Si el email existe, recibirás un enlace de recuperación." });
    }

    /// <summary>
    /// Restablece la contraseña usando el token recibido por email.
    /// </summary>
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        await _authService.ResetPasswordAsync(dto);
        return Ok(new { message = "Contraseña restablecida correctamente." });
    }

    // ── TOTP (Google Authenticator) — solo SuperAdmin ────────────────────────

    /// <summary>Estado actual del TOTP del usuario autenticado.</summary>
    [HttpGet("totp/status")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(TotpStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> TotpStatus()
    {
        var userId = User.FindFirst("sub")?.Value;
        if (userId is null) return Unauthorized();
        var result = await _authService.TotpStatusAsync(userId);
        return Ok(result);
    }

    /// <summary>Genera una semilla TOTP y devuelve el QR URI para escanear con la app.</summary>
    [HttpGet("totp/setup")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(TotpSetupResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> TotpSetup()
    {
        var userId = User.FindFirst("sub")?.Value;
        if (userId is null) return Unauthorized();
        var result = await _authService.TotpSetupAsync(userId);
        return Ok(result);
    }

    /// <summary>Confirma el setup verificando el primer código de la app. Activa TOTP y devuelve la identidad actualizada.</summary>
    [HttpPost("totp/confirm")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(IdentityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TotpConfirm([FromBody] TotpConfirmDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var userId = User.FindFirst("sub")?.Value;
        if (userId is null) return Unauthorized();
        var result = await _authService.TotpConfirmAsync(userId, dto.Code);
        return Ok(ApplyTokens(result));
    }

    /// <summary>Desactiva TOTP y devuelve la identidad actualizada con totpEnabled=false.</summary>
    [HttpPost("totp/disable")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(IdentityDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> TotpDisable()
    {
        var userId = User.FindFirst("sub")?.Value;
        if (userId is null) return Unauthorized();
        var result = await _authService.TotpDisableAsync(userId);
        return Ok(ApplyTokens(result));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Coloca tokens en cookies HttpOnly y devuelve solo la identidad al cliente.</summary>
    private IdentityDto ApplyTokens(TokenResponseDto tokens)
    {
        SetAccessTokenCookie(tokens.AccessToken);
        SetRefreshTokenCookie(tokens.RefreshToken);
        return new IdentityDto
        {
            Email       = tokens.UserEmail,
            Role        = tokens.Role,
            TotpEnabled = tokens.TotpEnabled
        };
    }

    private void SetAccessTokenCookie(string token)
    {
        Response.Cookies.Append("accessToken", token, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.Strict,
            Expires  = DateTimeOffset.UtcNow.AddMinutes(15)
        });
    }

    private void SetRefreshTokenCookie(string token)
    {
        Response.Cookies.Append("refreshToken", token, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.Strict,
            Expires  = DateTimeOffset.UtcNow.AddHours(24)
        });
    }
}
