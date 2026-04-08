using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IClientService
{
    Task<PagedResponseDto<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? name, int? companyId);
    Task<ClientResponseDto> GetByIdAsync(int id);
    Task<ClientResponseDto> CreateAsync(CreateClientDto dto);
    Task<ClientResponseDto> UpdateAsync(int id, UpdateClientDto dto);
    Task DeleteAsync(int id);
}
