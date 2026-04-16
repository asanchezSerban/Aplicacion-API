namespace ClientManager.API.Models;

public class EmailOtpCode
{
    public int      Id        { get; set; }
    public string   UserId    { get; set; } = string.Empty;
    public string   CodeHash  { get; set; } = string.Empty;  // SHA-256 hex
    public DateTime ExpiresAt { get; set; }
    public bool     IsUsed    { get; set; }
    public int      Attempts  { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
