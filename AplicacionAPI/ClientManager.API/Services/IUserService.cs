using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IUserService
{
    Task<PagedResponseDto<UserResponseDto>> GetAllAsync(int page, int pageSize, string? name, int? companyId);
    Task<UserResponseDto> GetByIdAsync(int id);
    Task<UserResponseDto> CreateAsync(CreateUserDto dto);
    Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto);
    Task DeleteAsync(int id);
}
