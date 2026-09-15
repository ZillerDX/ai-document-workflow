using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;

namespace AiDocumentWorkflow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowController : ControllerBase
    {
        private readonly IDocumentWorkflowService _workflowService;

        public WorkflowController(IDocumentWorkflowService workflowService)
        {
            _workflowService = workflowService;
        }

        [HttpPost("{id}/action")]
        public async Task<ActionResult<Document>> ProcessAction(Guid id, [FromBody] WorkflowActionDto dto)
        {
            try
            {
                var result = await _workflowService.ProcessActionAsync(id, dto);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message, role = dto.ActorRole });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
