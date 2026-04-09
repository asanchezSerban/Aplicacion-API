using ClientManager.API.DTOs;
using ClientManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClientManager.API.Controllers;

[ApiController]
[Route("api/companies")]
[Produces("application/json")]
[Authorize(Roles = "SuperAdmin")]
public class CompaniesController : ControllerBase
{
    private readonly ICompanyService _companyService;

    public CompaniesController(ICompanyService companyService)
    {
        _companyService = companyService;
    }

    /// <summary>
    /// Obtiene todas las empresas con paginación y filtros opcionales.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponseDto<CompanyResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? name = null,
        [FromQuery] string? status = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var result = await _companyService.GetAllAsync(page, pageSize, name, status);
        return Ok(result);
    }

    /// <summary>
    /// Obtiene una empresa por su ID.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(CompanyResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _companyService.GetByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// Crea una nueva empresa. Soporta subida de logo como multipart/form-data.
    /// </summary>
    [HttpPost]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CompanyResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromForm] CreateCompanyDto dto, IFormFile? logo)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _companyService.CreateAsync(dto, logo);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Actualiza una empresa existente. Soporta subida de logo como multipart/form-data.
    /// </summary>
    [HttpPut("{id:int}")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CompanyResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateCompanyDto dto, IFormFile? logo)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _companyService.UpdateAsync(id, dto, logo);
        return Ok(result);
    }

    /// <summary>
    /// Actualiza únicamente el estado de una empresa.
    /// </summary>
    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(typeof(CompanyResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateCompanyStatusDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _companyService.UpdateStatusAsync(id, dto);
        return Ok(result);
    }

    /// <summary>
    /// Elimina una empresa por su ID.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        await _companyService.DeleteAsync(id);
        return NoContent();
    }
}
