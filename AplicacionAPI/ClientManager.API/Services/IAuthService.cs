using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IAuthService
{
    Task<TokenResponseDto> LoginAsync(LoginDto dto);
    Task<TokenResponseDto> RefreshAsync(string refreshToken);
    Task RevokeAsync(string refreshToken);
    Task ForgotPasswordAsync(ForgotPasswordDto dto, string frontendBaseUrl);
    Task ResetPasswordAsync(ResetPasswordDto dto);
}
