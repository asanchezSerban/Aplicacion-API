using ClientManager.API.DTOs;
using ClientManager.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace ClientManager.API.Controllers;

[ApiController]
[Route("api/clients")]
[Produces("application/json")]
public class ClientsController : ControllerBase
{
    private readonly IClientService _clientService;

    public ClientsController(IClientService clientService)
    {
        _clientService = clientService;
    }

    /// <summary>
    /// Obtiene todos los clientes con paginación y filtros opcionales.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponseDto<ClientResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? name = null,
        [FromQuery] int? companyId = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var result = await _clientService.GetAllAsync(page, pageSize, name, companyId);
        return Ok(result);
    }

    /// <summary>
    /// Obtiene un cliente por su ID.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _clientService.GetByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// Crea un nuevo cliente asignado a una empresa.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateClientDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _clientService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Actualiza un cliente existente.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateClientDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var result = await _clientService.UpdateAsync(id, dto);
        return Ok(result);
    }

    /// <summary>
    /// Elimina un cliente por su ID.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        await _clientService.DeleteAsync(id);
        return NoContent();
    }
}
