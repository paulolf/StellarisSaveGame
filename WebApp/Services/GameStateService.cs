using System.IO.Compression;
using WebApp.Models;

namespace WebApp.Services;

public class GameStateService
{
    private readonly ILogger<GameStateService> _logger;
    private byte[]? _saveFileContent;
    private string _fileName = "";
    private readonly object _lock = new object();

    public GameStateService(ILogger<GameStateService> logger)
    {
        _logger = logger;
    }

    public async Task LoadSaveGameAsync(IFormFile file)
    {
        try
        {
            byte[] content;
            using (var memoryStream = new MemoryStream())
            {
                await file.CopyToAsync(memoryStream);
                content = memoryStream.ToArray();
            }

            lock (_lock)
            {
                _fileName = file.FileName;
                _saveFileContent = content;
                
                _logger.LogInformation("Successfully stored save file in memory: {FileName}, Size: {Size} bytes", 
                    _fileName, _saveFileContent.Length);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error storing save file: {FileName}", file.FileName);
            throw;
        }
    }

    public (byte[]? content, string filename) ExportCurrentState()
    {
        try
        {
            lock (_lock)
            {
                if (_saveFileContent == null || string.IsNullOrEmpty(_fileName))
                {
                    _logger.LogWarning("No save file content available for export");
                    return (null, string.Empty);
                }

                _logger.LogInformation("Exporting save file: {FileName}, Size: {Size} bytes", 
                    _fileName, _saveFileContent.Length);

                // Return a copy of the content to prevent external modifications
                var contentCopy = new byte[_saveFileContent.Length];
                Array.Copy(_saveFileContent, contentCopy, _saveFileContent.Length);

                return (contentCopy, _fileName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting save file: {FileName}", _fileName);
            return (null, string.Empty);
        }
    }

    public bool HasSaveFile()
    {
        lock (_lock)
        {
            return _saveFileContent != null && !string.IsNullOrEmpty(_fileName);
        }
    }

    // We'll implement parsing and modification later once we confirm
    // the basic file handling works correctly
    public ParadoxNode? GetCurrentState() => null;
}
