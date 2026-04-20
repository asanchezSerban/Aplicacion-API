using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IAuthService
{
    Task<LoginResponseDto>  LoginAsync(LoginDto dto);
    Task<TokenResponseDto>  MfaVerifyAsync(MfaVerifyDto dto);
    Task<DateTime>          ResendOtpAsync(string email);
    Task<TokenResponseDto>  RefreshAsync(string refreshToken);
    Task RevokeAsync(string refreshToken);
    Task ForgotPasswordAsync(ForgotPasswordDto dto, string frontendBaseUrl);
    Task ResetPasswordAsync(ResetPasswordDto dto);

    // TOTP
    Task<TotpStatusDto>        TotpStatusAsync(string userId);
    Task<TotpSetupResponseDto> TotpSetupAsync(string userId);
    Task<TokenResponseDto>     TotpConfirmAsync(string userId, string code);
    Task<TokenResponseDto>     TotpDisableAsync(string userId);
}
