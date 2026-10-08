using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AiDocumentWorkflow.Api.Auth;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;

namespace AiDocumentWorkflow.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class WorkflowController : ControllerBase
    {
        private readonly IDocumentWorkflowService _workflowService;

        public WorkflowController(IDocumentWorkflowService workflowService)
        {
            _workflowService = workflowService;
        }

        [HttpPost("{id}/action")]
        public async Task<ActionResult<DocumentDto>> ProcessAction(Guid id, [FromBody] WorkflowActionDto dto)
        {
            var actor = ActorContext.FromPrincipal(User);
            var result = await _workflowService.ProcessActionAsync(id, dto, actor);
            return Ok(DocumentDto.From(result));
        }
    }
}
