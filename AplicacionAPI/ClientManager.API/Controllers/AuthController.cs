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
    private readonly IEmailService _emailService;
    private readonly string _frontendBaseUrl;

    public AuthController(IAuthService authService, IEmailService emailService, IConfiguration configuration)
    {
        _authService     = authService;
        _emailService    = emailService;
        _frontendBaseUrl = configuration["Frontend:BaseUrl"] ?? "http://localhost:4200";
    }

    /// <summary>
    /// Verifica credenciales y envía un OTP por email. Devuelve requiresMfa=true si las credenciales son correctas.
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _authService.LoginAsync(dto);
        return Ok(result);
    }

    /// <summary>
    /// Verifica el OTP recibido por email y devuelve los tokens JWT si es correcto.
    /// </summary>
    [HttpPost("mfa-verify")]
    [ProducesResponseType(typeof(TokenResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> MfaVerify([FromBody] MfaVerifyDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _authService.MfaVerifyAsync(dto);
        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(result);
    }

    /// <summary>
    /// Renueva el access token usando el refresh token de la cookie.
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(TokenResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized("Refresh token no encontrado.");

        var result = await _authService.RefreshAsync(refreshToken);
        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(result);
    }

    /// <summary>
    /// Cierra sesión revocando el refresh token activo.
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

        Response.Cookies.Delete("refreshToken");
        return NoContent();
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

    /// <summary>Confirma el setup verificando el primer código de la app. Activa TOTP.</summary>
    [HttpPost("totp/confirm")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TotpConfirm([FromBody] TotpConfirmDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var userId = User.FindFirst("sub")?.Value;
        if (userId is null) return Unauthorized();
        await _authService.TotpConfirmAsync(userId, dto.Code);
        return Ok(new { message = "Autenticación en dos pasos activada correctamente." });
    }

    /// <summary>Desactiva TOTP y elimina la semilla del usuario.</summary>
    [HttpPost("totp/disable")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TotpDisable()
    {
        var userId = User.FindFirst("sub")?.Value;
        if (userId is null) return Unauthorized();
        await _authService.TotpDisableAsync(userId);
        return Ok(new { message = "Autenticación en dos pasos desactivada." });
    }

    // ── Helper ───────────────────────────────────────────────────────────────

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
