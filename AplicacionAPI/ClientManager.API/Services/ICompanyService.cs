using ClientManager.API.DTOs;

namespace ClientManager.API.Services;

public interface ICompanyService
{
    Task<PagedResponseDto<CompanyResponseDto>> GetAllAsync(int page, int pageSize, string? name, string? status);
    Task<CompanyResponseDto> GetByIdAsync(int id);
    Task<CompanyResponseDto> CreateAsync(CreateCompanyDto dto, IFormFile? logo);
    Task<CompanyResponseDto> UpdateAsync(int id, UpdateCompanyDto dto, IFormFile? logo);
    Task<CompanyResponseDto> UpdateStatusAsync(int id, UpdateCompanyStatusDto dto);
    Task DeleteAsync(int id);
}
