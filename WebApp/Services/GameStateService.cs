using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using WebApp.Models;

namespace WebApp.Services;

public class GameStateService : IGameStateService
{
    private readonly ILogger<GameStateService> _logger;
    private byte[]? _saveFileContent;
    private string? _fileName;
    private SaveGameInfo? _currentSaveInfo;

    public GameStateService(ILogger<GameStateService> logger)
    {
        _logger = logger;
    }

    public async Task LoadSaveGameAsync(IFormFile file)
    {
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        _saveFileContent = memoryStream.ToArray();
        _fileName = file.FileName;

        using var archive = new ZipArchive(new MemoryStream(_saveFileContent));
        var gamestatePath = archive.Entries.FirstOrDefault(e => e.Name == "gamestate");
        
        if (gamestatePath == null)
        {
            throw new InvalidOperationException("Invalid save file format: gamestate not found");
        }

        using var gamestateStream = gamestatePath.Open();
        using var reader = new StreamReader(gamestateStream);
        var content = await reader.ReadToEndAsync();

        ParseSaveGame(content);
    }

    private void ParseSaveGame(string content)
    {
        var saveInfo = new SaveGameInfo();

        // Extract basic info using regex
        saveInfo.GameDate = ExtractValue(content, "date=\"([^\"]*)\"") ?? "";
        saveInfo.Version = ExtractValue(content, "version=\"([^\"]*)\"") ?? "";
        saveInfo.IsIronman = content.Contains("ironman=yes");

        // Extract empire name
        var empireMatch = Regex.Match(content, @"empire=\s*{\s*name=\s*{\s*key=""([^""]*)""\s*}");
        if (empireMatch.Success)
        {
            saveInfo.EmpireName = empireMatch.Groups[1].Value;
        }

        // Parse planets
        var planets = new List<Planet>();
        var planetSection = ExtractSection(content, "planets=", "{", "}");
        if (!string.IsNullOrEmpty(planetSection))
        {
            var planetMatches = Regex.Matches(planetSection, @"(\d+)=\s*{([^}]+)}");
            foreach (Match planetMatch in planetMatches)
            {
                var planetId = planetMatch.Groups[1].Value;
                var planetContent = planetMatch.Groups[2].Value;

                var planet = new Planet
                {
                    Id = planetId,
                    Name = ExtractPlanetName(planetContent),
                    Type = ExtractValue(planetContent, "planet_class=\"([^\"]*)\"") ?? "",
                    Size = int.Parse(ExtractValue(planetContent, "planet_size=(\\d+)") ?? "0")
                };

                planets.Add(planet);
                _logger.LogInformation($"Found planet: {planet.Name} (ID: {planet.Id}, Type: {planet.Type}, Size: {planet.Size})");
            }
        }

        saveInfo.Planets = planets;
        saveInfo.NumPlanets = planets.Count;
        _currentSaveInfo = saveInfo;
    }

    private string? ExtractValue(string content, string pattern)
    {
        var match = Regex.Match(content, pattern);
        return match.Success ? match.Groups[1].Value : null;
    }

    private string ExtractSection(string content, string startMarker, string openBrace, string closeBrace)
    {
        var startIndex = content.IndexOf(startMarker);
        if (startIndex == -1) return string.Empty;

        startIndex += startMarker.Length;
        
        // Find the first opening brace after the marker
        var firstBrace = content.IndexOf(openBrace, startIndex);
        if (firstBrace == -1) return string.Empty;

        // Count braces to handle nesting
        var braceCount = 1;
        var currentPos = firstBrace + 1;
        var contentLength = content.Length;

        while (braceCount > 0 && currentPos < contentLength)
        {
            if (content[currentPos] == '{')
            {
                braceCount++;
            }
            else if (content[currentPos] == '}')
            {
                braceCount--;
            }
            currentPos++;
        }

        if (braceCount > 0) return string.Empty; // Unmatched braces
        
        // Include the entire section including the outer braces
        return content.Substring(firstBrace, currentPos - firstBrace);
    }

    private string ExtractPlanetName(string planetContent)
    {
        // Try to extract name with variables first
        var nameWithVarsPattern = "name=\\s*{\\s*key=\"([^\"]*)\"\\s*variables=\\s*{\\s*{\\s*key=\"NAME\"\\s*value=\\s*{\\s*key=\"([^\"]*)\"";
        var nameMatch = Regex.Match(planetContent, nameWithVarsPattern);
        if (nameMatch.Success)
        {
            // If we have a variable name, use that
            if (nameMatch.Groups.Count > 2)
            {
                return nameMatch.Groups[2].Value;
            }
            // Otherwise use the key
            return nameMatch.Groups[1].Value;
        }

        // Try simple name format
        var simpleNamePattern = "name=\\s*{\\s*key=\"([^\"]*)\"\\s*}";
        var simpleNameMatch = Regex.Match(planetContent, simpleNamePattern);
        if (simpleNameMatch.Success)
        {
            return simpleNameMatch.Groups[1].Value;
        }

        return "Unknown";
    }

    public SaveGameInfo? GetCurrentSaveInfo()
    {
        return _currentSaveInfo;
    }

    public (byte[]? content, string? filename) ExportCurrentState()
    {
        return (_saveFileContent, _fileName);
    }

    public bool HasSaveFile()
    {
        return _saveFileContent != null && !string.IsNullOrEmpty(_fileName);
    }

    public async Task UpdatePlanetSizeAsync(string planetId, int newSize)
    {
        if (_saveFileContent == null || _fileName == null)
        {
            throw new InvalidOperationException("No save file loaded");
        }

        using var archive = new ZipArchive(new MemoryStream(_saveFileContent));
        var gamestatePath = archive.Entries.FirstOrDefault(e => e.Name == "gamestate");
        
        if (gamestatePath == null)
        {
            throw new InvalidOperationException("Invalid save file format: gamestate not found");
        }

        using var gamestateStream = gamestatePath.Open();
        using var reader = new StreamReader(gamestateStream);
        var content = await reader.ReadToEndAsync();

        // Update the planet size in the content
        var planetPattern = planetId + "=\\s*{([^}]+)planet_size=\\d+([^}]+)}";
        var updatedContent = Regex.Replace(content, planetPattern, m =>
        {
            return $"{planetId}={{{m.Groups[1]}planet_size={newSize}{m.Groups[2]}}}";
        });

        // Update the in-memory save info
        if (_currentSaveInfo != null)
        {
            var planet = _currentSaveInfo.Planets.FirstOrDefault(p => p.Id == planetId);
            if (planet != null)
            {
                planet.Size = newSize;
            }
        }

        // Create a new zip file with the updated content
        using var newZipStream = new MemoryStream();
        using (var newArchive = new ZipArchive(newZipStream, ZipArchiveMode.Create, true))
        {
            foreach (var entry in archive.Entries)
            {
                var newEntry = newArchive.CreateEntry(entry.Name);
                using var entryStream = entry.Open();
                using var newEntryStream = newEntry.Open();

                if (entry.Name == "gamestate")
                {
                    var bytes = Encoding.UTF8.GetBytes(updatedContent);
                    await newEntryStream.WriteAsync(bytes);
                }
                else
                {
                    await entryStream.CopyToAsync(newEntryStream);
                }
            }
        }

        _saveFileContent = newZipStream.ToArray();
    }
}
