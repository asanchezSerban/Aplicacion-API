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

public class TokenResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
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
    public string? MfaType  { get; set; }  // "email" | "totp"

    // Solo cuando RequiresMfa = false
    public string? AccessToken  { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime ExpiresAt   { get; set; }
    public string? UserEmail    { get; set; }
    public string? Role         { get; set; }
}

public class TotpSetupResponseDto
{
    public string QrUri  { get; set; } = string.Empty;  // otpauth:// URI para el QR
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
