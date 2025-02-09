# Stellaris Save Game Editor

A web-based save game editor for Stellaris, built with ASP.NET Core.

## Features

- Upload and download Stellaris save files
- Preserves save file integrity
- Adds "_edited" suffix to modified save files
- Thread-safe file handling

## Requirements

- .NET 8.0 SDK
- Web browser

## Development Setup

1. Clone the repository
```bash
git clone https://github.com/paulolf/StellarisSaveGame.git
```

2. Navigate to the WebApp directory
```bash
cd StellarisSaveGame/WebApp
```

3. Run the application
```bash
dotnet run
```

4. Open your browser and navigate to `https://localhost:5001` or `http://localhost:5000`

## Usage

1. Click the "Choose File" button and select your Stellaris save file (*.sav)
2. Click "Upload Save" to upload your save file
3. Once uploaded, click "Download Save" to download the file
4. The downloaded file will have "_edited" added to its name to prevent overwriting the original

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
