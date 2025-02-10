using Microsoft.AspNetCore.Mvc;
using WebApp.Services;
using WebApp.Models;

namespace WebApp.Controllers
{
    public class PlanetController : Controller
    {
        private readonly IGameStateService _gameStateService;

        public PlanetController(IGameStateService gameStateService)
        {
            _gameStateService = gameStateService;
        }

        public IActionResult Index()
        {
            if (!_gameStateService.HasSaveFile())
            {
                return RedirectToAction("Index", "Home");
            }

            var gameState = _gameStateService.GetCurrentSaveInfo();
            return View(gameState?.Planets ?? new List<Planet>());
        }

        public IActionResult Edit(string id)
        {
            if (!_gameStateService.HasSaveFile())
            {
                return RedirectToAction("Index", "Home");
            }

            var gameState = _gameStateService.GetCurrentSaveInfo();
            var planet = gameState?.Planets.FirstOrDefault(p => p.Id == id);
            
            if (planet == null)
            {
                return NotFound();
            }

            return View(planet);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(string id, [Bind("Id,Name,Type,Class,Size")] Planet planet)
        {
            if (id != planet.Id)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    await _gameStateService.UpdatePlanetSizeAsync(planet.Id, planet.Size);
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception)
                {
                    ModelState.AddModelError("", "An error occurred while saving the changes.");
                }
            }

            return View(planet);
        }
    }
}
