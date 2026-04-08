using Microsoft.AspNetCore.Identity;

namespace ClientManager.API.Models;

public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// Null para SuperAdmin. Vinculado al Client de la tabla Clients en Fase 6.
    /// </summary>
    public int? ClientId { get; set; }

    public Client? Client { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
