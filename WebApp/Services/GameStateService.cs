using System.IO.Compression;
using System.Text;
using WebApp.Models;

namespace WebApp.Services;

public class GameStateService
{
    private readonly ILogger<GameStateService> _logger;
    private byte[]? _saveFileContent;
    private string _fileName = "";
    private SaveGameInfo? _currentSaveInfo;
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
                _currentSaveInfo = ParseSaveGame(content);
                
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

    private SaveGameInfo ParseSaveGame(byte[] content)
    {
        try
        {
            using var ms = new MemoryStream(content);
            using var zip = new ZipArchive(ms, ZipArchiveMode.Read);
            
            // Stellaris save files are typically compressed with a single gamestate file
            var entry = zip.Entries.FirstOrDefault(e => e.Name.EndsWith("gamestate"));
            if (entry == null)
            {
                _logger.LogWarning("No gamestate file found in save game");
                return new SaveGameInfo();
            }

            using var entryStream = entry.Open();
            using var reader = new StreamReader(entryStream, Encoding.UTF8);
            var gameState = reader.ReadToEnd();

            var info = new SaveGameInfo
            {
                LastSaveTime = entry.LastWriteTime.DateTime
            };

            // Parse the gamestate content
            // The format is similar to PDX's custom format with key=value pairs and nested blocks
            var lines = gameState.Split('\n');
            var currentBlock = "";
            
            foreach (var line in lines)
            {
                var trimmedLine = line.Trim();
                
                if (trimmedLine.StartsWith("date="))
                {
                    info.GameDate = trimmedLine.Split('=')[1].Trim('"');
                }
                else if (trimmedLine.StartsWith("name=") && currentBlock.Contains("player_country"))
                {
                    info.EmpireName = trimmedLine.Split('=')[1].Trim('"');
                }
                else if (trimmedLine.StartsWith("version="))
                {
                    info.Version = trimmedLine.Split('=')[1].Trim('"');
                }
                else if (trimmedLine.StartsWith("ironman="))
                {
                    info.IsIronman = trimmedLine.Split('=')[1].Trim().ToLower() == "yes";
                }
                else if (trimmedLine.EndsWith("{"))
                {
                    currentBlock = trimmedLine;
                }
                else if (trimmedLine == "}")
                {
                    currentBlock = "";
                }
                
                // Count planets owned by the player
                if (currentBlock.Contains("planets") && trimmedLine.Contains("owner=") && trimmedLine.Contains("player"))
                {
                    info.NumPlanets++;
                }
                
                // Parse resources
                if (currentBlock.Contains("resources"))
                {
                    var resourceParts = trimmedLine.Split('=');
                    if (resourceParts.Length == 2 && decimal.TryParse(resourceParts[1].Trim(), out var amount))
                    {
                        var resourceName = resourceParts[0].Trim();
                        info.Resources[resourceName] = amount;
                    }
                }
            }

            return info;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing save game");
            return new SaveGameInfo();
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

    public SaveGameInfo? GetCurrentSaveInfo()
    {
        lock (_lock)
        {
            return _currentSaveInfo;
        }
    }

    public bool HasSaveFile()
    {
        lock (_lock)
        {
            return _saveFileContent != null && !string.IsNullOrEmpty(_fileName);
        }
    }
}
