using System.Globalization;
using Markdig;

namespace Blog.Properties.Post;
public record PostInfo(string Slug, string Title, DateTime Time, ReadOnlyMemory<string> Categories, string HTMLContent) : IComparable<PostInfo>
{
    public int CompareTo(PostInfo? other)
    {
        if (other is null)
        {
            return 1;
        }
        
        return other.Time.CompareTo(Time);
    }
}

/// <summary>
/// wwwroot/Posts/*.md 는 빌드 시 "Posts/{파일명}" 리소스로 어셈블리에 포함된다 (Blog.csproj 참고).
/// 파일 이름이 '_' 로 시작하는 글은 목록(SortedPostByTime)에서 숨기고, URL 로 직접 접근할 때만 보인다.
/// </summary>
public sealed class PostRepository
{
    private const string ResourcePrefix = "Posts/";

    private static readonly MarkdownPipeline pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();

    public static string ToHtml(string markdown) => Markdown.ToHtml(markdown, pipeline);

    private readonly Dictionary<string, PostInfo> posts = [];

    private readonly List<PostInfo> sortedList = [];

    public IReadOnlyDictionary<string, PostInfo> PostDict => posts;

    public IReadOnlyList<PostInfo> SortedPostByTime => sortedList;

    public void Initialize()
    {
        if (posts.Count > 0) return;

        var assembly = typeof(PostRepository).Assembly;

        foreach (var name in assembly.GetManifestResourceNames())
        {
            if (!name.StartsWith(ResourcePrefix) || !name.EndsWith(".md")) continue;

            using var stream = assembly.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);

            var slug = name[ResourcePrefix.Length..^".md".Length];
            var info = Parse(slug, reader.ReadToEnd());

            if (!posts.TryAdd(info.Slug, info))
            {
                Console.Error.WriteLine($"{info.Slug} is duplicated.");
            }
        }

        sortedList.AddRange(posts.Values.Where(p => !IsHidden(p)));
        sortedList.Sort();
    }

    public static bool IsHidden(PostInfo post) => post.Slug.StartsWith('_');

    public PostInfo? GetPost(string slug)
    {
        if (posts.TryGetValue(slug, out PostInfo? post))
        {
            return post;
        }

        return null;
    }

    /// <summary>
    /// 맨 앞의 front matter 를 읽는다. 모든 항목은 생략 가능하며, title 이 없으면 파일 이름을 쓴다.
    /// <code>
    /// ---
    /// title: 글 제목
    /// date: 2026-10-14 14:31
    /// tags: [C#, blazor]
    /// ---
    /// </code>
    /// </summary>
    private static PostInfo Parse(string slug, string text)
    {
        text = text.Replace("\r\n", "\n");

        string title = slug;
        DateTime time = DateTime.MinValue;
        string[] tags = [];

        if (text.StartsWith("---\n"))
        {
            int end = text.IndexOf("\n---", 3);
            if (end >= 0)
            {
                foreach (var line in text[4..end].Split('\n'))
                {
                    int colon = line.IndexOf(':');
                    if (colon < 0) continue;

                    var key = line[..colon].Trim().ToLowerInvariant();
                    var value = line[(colon + 1)..].Trim();

                    switch (key)
                    {
                        case "title" when value.Length > 0:
                            title = value;
                            break;
                        case "date":
                            DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
                            break;
                        case "tags":
                            tags = value.Trim('[', ']').Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                            break;
                    }
                }

                int bodyStart = text.IndexOf('\n', end + 1);
                text = bodyStart < 0 ? string.Empty : text[(bodyStart + 1)..];
            }
        }

        return new PostInfo(slug, title, time, tags, ToHtml(text));
    }
}
