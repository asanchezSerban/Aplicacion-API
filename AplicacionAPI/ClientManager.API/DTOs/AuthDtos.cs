using System.ComponentModel.DataAnnotations;

namespace ClientManager.API.DTOs;

public class LoginDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

/// <summary>Identidad del usuario autenticado — devuelta en respuestas de auth y en GET /auth/me.</summary>
public class IdentityDto
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool TotpEnabled { get; set; }
    public string? UserId { get; set; }  // solo rol Cliente
}

public class TokenResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool TotpEnabled { get; set; }
}

public class ForgotPasswordDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;
}

public class LoginResponseDto
{
    public bool RequiresMfa { get; set; }

    // Solo cuando RequiresMfa = true
    public string? MfaEmail { get; set; }
    public string? MfaType { get; set; }  // "email" | "totp"

    // Solo cuando MfaType = "email" — TTL exacto del OTP para sincronizar el timer del frontend
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? OtpExpiresAt { get; set; }

    // Solo cuando RequiresMfa = false — tokens van en cookie HttpOnly, no en el body
    [System.Text.Json.Serialization.JsonIgnore]
    public string? AccessToken { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public string? RefreshToken { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public DateTime ExpiresAt { get; set; }

    // Identidad (cuando RequiresMfa = false)
    public string? Email { get; set; }
    public string? Role { get; set; }
    public bool TotpEnabled { get; set; }
}

public class TotpSetupResponseDto
{
    public string QrUri { get; set; } = string.Empty;  // otpauth:// URI para el QR
    public string Secret { get; set; } = string.Empty;  // Base32, para entrada manual
}

public class TotpConfirmDto
{
    [Required]
    [StringLength(6, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;
}

public class TotpStatusDto
{
    public bool Enabled { get; set; }
}

public class MfaVerifyDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(6, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;
}

public class ResendOtpDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}
