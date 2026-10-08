using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace AiDocumentWorkflow.Api.Services
{
    /// <summary>Maps domain exceptions to HTTP status codes so controllers stay free of try/catch.</summary>
    public class ExceptionMappingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionMappingMiddleware> _logger;

        public ExceptionMappingMiddleware(RequestDelegate next, ILogger<ExceptionMappingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex) when (!context.Response.HasStarted)
            {
                var status = ex switch
                {
                    UnauthorizedAccessException => StatusCodes.Status403Forbidden,
                    KeyNotFoundException => StatusCodes.Status404NotFound,
                    ConflictException => StatusCodes.Status409Conflict,
                    InvalidOperationException => StatusCodes.Status409Conflict,
                    ArgumentException => StatusCodes.Status400BadRequest,
                    _ => StatusCodes.Status500InternalServerError
                };

                if (status == StatusCodes.Status500InternalServerError)
                {
                    _logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);
                }

                context.Response.Clear();
                context.Response.StatusCode = status;
                var message = status == StatusCodes.Status500InternalServerError ? "An unexpected error occurred." : ex.Message;
                await context.Response.WriteAsJsonAsync(new { message });
            }
        }
    }
}
