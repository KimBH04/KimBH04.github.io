using System.Net.Http.Json;
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

public sealed class PostRepository(HttpClient http)
{
    private readonly HttpClient http = http;

    private readonly Dictionary<string, PostInfo> posts = [];

    private readonly List<PostInfo> sortedList = [];

    private bool initialized = false;

    private static readonly SemaphoreSlim initLock = new(1, 1);

    public IReadOnlyDictionary<string, PostInfo> PostDict => posts;

    public IReadOnlyList<PostInfo> SortedPostByTime => sortedList;

    public async Task Initialize()
    {
        await initLock.WaitAsync();

        if (initialized) return;

        var json = await http.GetFromJsonAsync<PostInfo[]>("posts.json")
                ?? throw new InvalidOperationException("Can't read \"posts.json\".");

        var task = json.Select(async info =>
        {
            try
            {
                string content = await http.GetStringAsync($"Posts/{info.Slug}.md");
                return info with { HTMLContent = Markdown.ToHtml(content) };
            }
            catch (Exception e)
            {
                Console.WriteLine($"{info.Slug} is failed : {e}");
                return null;
            }
        });

        var res = await Task.WhenAll(task);
        foreach (var info in res)
        {
            if (info is null) continue;

            if (!posts.TryAdd(info.Slug, info))
            {
                Console.Error.WriteLine($"{info.Slug} is duplicated.");
            }
        }

        sortedList.AddRange(posts.Values);
        sortedList.Sort();

        initialized = true;

        initLock.Release();
    }

    public PostInfo? GetPost(string slug)
    {
        if (posts.TryGetValue(slug, out PostInfo? post))
        {
            return post;
        }

        return null;
    }
}