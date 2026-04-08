using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IAuthService
{
    Task<TokenResponseDto> LoginAsync(LoginDto dto);
}
