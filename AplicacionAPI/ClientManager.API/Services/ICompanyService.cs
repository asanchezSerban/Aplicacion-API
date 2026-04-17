using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface ICompanyService
{
    Task<PagedResponseDto<CompanyResponseDto>> GetAllAsync(int page, int pageSize, string? name, CancellationToken ct = default);
    Task<CompanyResponseDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<CompanyResponseDto> CreateAsync(CreateCompanyDto dto, IFormFile? logo, CancellationToken ct = default);
    Task<CompanyResponseDto> UpdateAsync(int id, UpdateCompanyDto dto, IFormFile? logo, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
