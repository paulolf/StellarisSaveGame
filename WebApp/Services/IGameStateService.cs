using WebApp.Models;

namespace WebApp.Services;

public interface IGameStateService
{
    Task LoadSaveGameAsync(IFormFile file);
    SaveGameInfo? GetCurrentSaveInfo();
    bool HasSaveFile();
    (byte[]? content, string? filename) ExportCurrentState();
    Task UpdatePlanetSizeAsync(string planetId, int newSize);
}
