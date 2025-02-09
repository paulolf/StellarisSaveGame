using System.Text;

namespace WebApp.Models;

public class ParadoxNode
{
    public string? Name { get; set; }
    public string? Value { get; set; }
    public List<ParadoxNode> Children { get; } = new();
    public ParadoxNode? Parent { get; set; }

    public override string ToString()
    {
        var sb = new StringBuilder();
        BuildString(sb, 0);
        return sb.ToString();
    }

    private void BuildString(StringBuilder sb, int indent)
    {
        var indentStr = new string('\t', indent);
        
        if (!string.IsNullOrEmpty(Name))
        {
            sb.Append(indentStr).Append(Name);
            if (!string.IsNullOrEmpty(Value))
            {
                sb.Append('=').Append(Value);
            }
            sb.AppendLine();
        }

        if (Children.Count > 0)
        {
            sb.AppendLine(indentStr + "{");
            foreach (var child in Children)
            {
                child.BuildString(sb, indent + 1);
            }
            sb.AppendLine(indentStr + "}");
        }
    }
}
