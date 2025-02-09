using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using WebApp.Services;
using WebApp.Models;
using System.IO;
using System.Net.Mime;
using System.Text;

namespace WebApp.Pages;

public class IndexModel : PageModel
{
    private readonly ILogger<IndexModel> _logger;
    private readonly GameStateService _gameStateService;

    public bool HasUploadedFile => _gameStateService.HasSaveFile();

    public IndexModel(ILogger<IndexModel> logger, GameStateService gameStateService)
    {
        _logger = logger;
        _gameStateService = gameStateService;
    }

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnPostAsync(IFormFile saveFile)
    {
        if (saveFile == null || saveFile.Length == 0)
        {
            ModelState.AddModelError("", "Please select a file to upload.");
            return Page();
        }

        try
        {
            _logger.LogInformation("Received file upload: {FileName}, {Length} bytes", 
                saveFile.FileName, saveFile.Length);
            
            await _gameStateService.LoadSaveGameAsync(saveFile);
            return Page();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing save file");
            ModelState.AddModelError("", "Error processing save file: " + ex.Message);
            return Page();
        }
    }

    public IActionResult OnGetDownload()
    {
        try
        {
            var (content, filename) = _gameStateService.ExportCurrentState();
            if (content == null || string.IsNullOrEmpty(filename))
            {
                _logger.LogWarning("Attempted to download when no file is available");
                return NotFound("No save file available for download.");
            }

            // Add _edited suffix before the extension
            var newFilename = Path.GetFileNameWithoutExtension(filename) + "_edited" + Path.GetExtension(filename);

            // Create Content-Disposition header with proper encoding for special characters
            var cd = new ContentDisposition
            {
                FileName = newFilename,
                Inline = false
            };

            Response.Headers.Add("Content-Disposition", cd.ToString());

            _logger.LogInformation("Downloading save file as: {FileName}, {Length} bytes", 
                newFilename, content.Length);

            return File(content, "application/octet-stream");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading save file");
            return StatusCode(500, "Error downloading the save file.");
        }
    }
}
