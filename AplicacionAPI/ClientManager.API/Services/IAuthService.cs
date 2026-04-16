using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IAuthService
{
    Task<LoginResponseDto>  LoginAsync(LoginDto dto);
    Task<TokenResponseDto>  MfaVerifyAsync(MfaVerifyDto dto);
    Task<TokenResponseDto>  RefreshAsync(string refreshToken);
    Task RevokeAsync(string refreshToken);
    Task ForgotPasswordAsync(ForgotPasswordDto dto, string frontendBaseUrl);
    Task ResetPasswordAsync(ResetPasswordDto dto);
}
