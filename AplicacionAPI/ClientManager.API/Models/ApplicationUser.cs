using Microsoft.AspNetCore.Identity;

namespace ClientManager.API.Models;

public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// Null para SuperAdmin. Vinculado al User de la tabla Users.
    /// </summary>
    public int? UserId { get; set; }

    public User? User { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // TOTP (Google Authenticator) — solo SuperAdmin
    public string? TotpSecret  { get; set; }
    public bool    TotpEnabled { get; set; }
}
