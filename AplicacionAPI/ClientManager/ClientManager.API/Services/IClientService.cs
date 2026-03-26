using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface IClientService
{
    Task<PagedResponseDto<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? name, string? status);
    Task<ClientResponseDto> GetByIdAsync(int id);
    Task<ClientResponseDto> CreateAsync(CreateClientDto dto, IFormFile? logo);
    Task<ClientResponseDto> UpdateAsync(int id, UpdateClientDto dto, IFormFile? logo);
    Task<ClientResponseDto> UpdateStatusAsync(int id, UpdateStatusDto dto);
    Task DeleteAsync(int id);
}
