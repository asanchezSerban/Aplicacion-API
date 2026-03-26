using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace ClientManager.API;

public class FileUploadOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var httpMethod = context.ApiDescription.HttpMethod?.ToUpperInvariant();
        if (httpMethod is not ("POST" or "PUT")) return;

        var fileParams = context.ApiDescription.ParameterDescriptions
            .Where(p => p.Type == typeof(IFormFile))
            .ToList();

        if (fileParams.Count == 0) return;

        var formDataProperties = new Dictionary<string, OpenApiSchema>();

        // Add DTO properties from the non-file parameters
        foreach (var param in context.ApiDescription.ParameterDescriptions.Where(p => p.Type != typeof(IFormFile)))
        {
            formDataProperties[param.Name] = new OpenApiSchema
            {
                Type = "string"
            };
        }

        // Add file parameter
        foreach (var param in fileParams)
        {
            formDataProperties[param.Name] = new OpenApiSchema
            {
                Type = "string",
                Format = "binary"
            };
        }

        operation.RequestBody = new OpenApiRequestBody
        {
            Content = new Dictionary<string, OpenApiMediaType>
            {
                ["multipart/form-data"] = new OpenApiMediaType
                {
                    Schema = new OpenApiSchema
                    {
                        Type = "object",
                        Properties = formDataProperties
                    }
                }
            }
        };
    }
}
