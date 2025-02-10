using System;

namespace WebApp.Models;

public class SaveGameInfo
{
    public string GameDate { get; set; } = "";
    public string EmpireName { get; set; } = "";
    public int NumPlanets { get; set; }
    public Dictionary<string, decimal> Resources { get; set; } = new();
    public bool IsIronman { get; set; }
    public string Version { get; set; } = "";
    public DateTime LastSaveTime { get; set; }
}
