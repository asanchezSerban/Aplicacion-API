using System.Collections.Concurrent;

namespace ClientManager.API.Services;

/// <summary>
/// In-memory store for plain OTP codes.
/// Only populated in Development; exposed via GET /api/dev/last-otp so k6 tests
/// can read the code without requiring smtp4dev to be running.
/// </summary>
public static class DevOtpStore
{
    private static readonly ConcurrentDictionary<string, string> _codes = new();

    public static void Set(string email, string code) =>
        _codes[email.ToLowerInvariant()] = code;

    public static string? Get(string email) =>
        _codes.GetValueOrDefault(email.ToLowerInvariant());
}
