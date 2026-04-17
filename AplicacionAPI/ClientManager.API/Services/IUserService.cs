using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IUserService
{
    Task<PagedResponseDto<UserResponseDto>> GetAllAsync(int page, int pageSize, string? name, int? companyId, CancellationToken ct = default);
    Task<UserResponseDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<UserResponseDto> CreateAsync(CreateUserDto dto, CancellationToken ct = default);
    Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
