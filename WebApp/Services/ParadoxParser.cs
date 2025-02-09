using System.Text;
using WebApp.Models;

namespace WebApp.Services;

public class ParadoxParser
{
    private readonly ILogger<ParadoxParser> _logger;
    private int _position;
    private string _input = "";

    public ParadoxParser(ILogger<ParadoxParser> logger)
    {
        _logger = logger;
    }

    public ParadoxNode Parse(string input)
    {
        _input = input;
        _position = 0;
        return ParseNode();
    }

    private ParadoxNode ParseNode()
    {
        var node = new ParadoxNode();
        SkipWhitespace();

        // Parse name if present
        if (_position < _input.Length && !IsSpecialChar(_input[_position]))
        {
            node.Name = ParseIdentifier();
            SkipWhitespace();

            // Parse value if present
            if (_position < _input.Length && _input[_position] == '=')
            {
                _position++; // Skip '='
                SkipWhitespace();
                node.Value = ParseValue();
            }
        }

        SkipWhitespace();

        // Parse child nodes if present
        if (_position < _input.Length && _input[_position] == '{')
        {
            _position++; // Skip '{'
            while (_position < _input.Length)
            {
                SkipWhitespace();
                if (_position >= _input.Length) break;
                if (_input[_position] == '}')
                {
                    _position++;
                    break;
                }

                var child = ParseNode();
                child.Parent = node;
                node.Children.Add(child);
            }
        }

        return node;
    }

    private string ParseIdentifier()
    {
        var sb = new StringBuilder();
        while (_position < _input.Length && !IsSpecialChar(_input[_position]))
        {
            sb.Append(_input[_position++]);
        }
        return sb.ToString().Trim();
    }

    private string ParseValue()
    {
        var sb = new StringBuilder();
        bool inQuotes = false;

        while (_position < _input.Length)
        {
            char c = _input[_position];

            if (c == '"')
            {
                inQuotes = !inQuotes;
                sb.Append(c);
                _position++;
                continue;
            }

            if (!inQuotes && (c == '{' || c == '}' || c == '\n' || c == '\r'))
            {
                break;
            }

            sb.Append(c);
            _position++;
        }

        return sb.ToString().Trim();
    }

    private void SkipWhitespace()
    {
        while (_position < _input.Length && char.IsWhiteSpace(_input[_position]))
        {
            _position++;
        }
    }

    private bool IsSpecialChar(char c)
    {
        return char.IsWhiteSpace(c) || c == '=' || c == '{' || c == '}' || c == '"';
    }
}
