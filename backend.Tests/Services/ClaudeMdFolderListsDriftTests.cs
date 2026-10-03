using System.Text.RegularExpressions;

namespace Utanvega.Backend.Tests.Services;

// Guards against the drift #1159 was filed for: CLAUDE.md:48 and CLAUDE.md:55 enumerate
// backend/Application's feature folders and backend.Tests/'s top-level folders exhaustively
// (decided in #1150). Nothing enforced that those two lists stayed in sync with the real folder
// sets going forward, so this reads both CLAUDE.md and the actual directories rather than
// duplicating the lists — adding/removing a folder on either side without updating CLAUDE.md
// fails these tests.
public class ClaudeMdFolderListsDriftTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "CLAUDE.md")))
            dir = dir.Parent;

        return dir?.FullName
            ?? throw new DirectoryNotFoundException("Could not locate repo root (expected to find CLAUDE.md above the test bin directory).");
    }

    private static IReadOnlyList<string> GetTopLevelFolderNames(string parentDir, params string[] exclude)
    {
        if (!Directory.Exists(parentDir))
            throw new DirectoryNotFoundException($"Expected directory not found: {parentDir}");

        return Directory.GetDirectories(parentDir)
            .Select(Path.GetFileName)
            .Where(name => name is not null && !exclude.Contains(name, StringComparer.OrdinalIgnoreCase))
            .Select(name => name!)
            .ToArray();
    }

    // Matches CLAUDE.md:48's bullet: "- `Application/<Feature>/Commands|Queries` — ... (A, B, C)."
    // and pulls the trailing parenthetical comma-list.
    private static IReadOnlyList<string> ExtractApplicationFeatureFolders(string claudeMdContent)
    {
        var line = claudeMdContent
            .Split('\n')
            .FirstOrDefault(l => l.Contains("Application/<Feature>/Commands|Queries"))
            ?? throw new InvalidOperationException(
                "Could not find the 'Application/<Feature>/Commands|Queries' bullet in CLAUDE.md.");

        var match = Regex.Match(line, @"\(([^()]+)\)\.?\s*$");
        if (!match.Success)
            throw new InvalidOperationException(
                $"Could not find a trailing parenthetical folder list on the Application bullet line: {line}");

        return match.Groups[1].Value
            .Split(',')
            .Select(s => s.Trim())
            .Where(s => s.Length > 0)
            .ToArray();
    }

    // Matches CLAUDE.md:55's bullet: "**backend.Tests/** — ... organized to mirror source:
    // `Caching/`, `Endpoints/`, ..., `WebHost/`." and pulls the backtick-quoted folder names.
    private static IReadOnlyList<string> ExtractBackendTestsFolders(string claudeMdContent)
    {
        var line = claudeMdContent
            .Split('\n')
            .FirstOrDefault(l => l.Contains("**backend.Tests/**"))
            ?? throw new InvalidOperationException("Could not find the 'backend.Tests/' bullet in CLAUDE.md.");

        var markerIndex = line.IndexOf("organized to mirror source:", StringComparison.Ordinal);
        if (markerIndex < 0)
            throw new InvalidOperationException(
                $"Could not find 'organized to mirror source:' on the backend.Tests bullet line: {line}");

        var afterMarker = line[markerIndex..];
        var matches = Regex.Matches(afterMarker, "`([^`]+)`");
        if (matches.Count == 0)
            throw new InvalidOperationException(
                $"Could not find any backtick-quoted folder names after 'organized to mirror source:': {afterMarker}");

        return matches
            .Select(m => m.Groups[1].Value.TrimEnd('/'))
            .ToArray();
    }

    private static (IReadOnlyList<string> missingFromDocs, IReadOnlyList<string> missingFromDisk) ComputeDrift(
        IEnumerable<string> documented, IEnumerable<string> actual)
    {
        var documentedSet = new HashSet<string>(documented, StringComparer.Ordinal);
        var actualSet = new HashSet<string>(actual, StringComparer.Ordinal);

        return (
            actualSet.Except(documentedSet).OrderBy(s => s, StringComparer.Ordinal).ToArray(),
            documentedSet.Except(actualSet).OrderBy(s => s, StringComparer.Ordinal).ToArray());
    }

    private static string BuildDriftMessage(
        string folderDescription, string claudeMdLocation,
        IReadOnlyList<string> missingFromDocs, IReadOnlyList<string> missingFromDisk)
    {
        var messages = new List<string>();
        if (missingFromDocs.Count > 0)
            messages.Add($"present in {folderDescription} but missing from {claudeMdLocation}: {string.Join(", ", missingFromDocs)}");
        if (missingFromDisk.Count > 0)
            messages.Add($"listed in {claudeMdLocation} but no longer exist in {folderDescription}: {string.Join(", ", missingFromDisk)}");

        return string.Join("; ", messages);
    }

    [Fact]
    public void ApplicationFeatureFolders_MatchClaudeMdList()
    {
        var claudeMd = File.ReadAllText(Path.Combine(RepoRoot(), "CLAUDE.md"));
        var documented = ExtractApplicationFeatureFolders(claudeMd);
        var actual = GetTopLevelFolderNames(Path.Combine(RepoRoot(), "backend", "Application"));

        var (missingFromDocs, missingFromDisk) = ComputeDrift(documented, actual);

        Assert.True(missingFromDocs.Count == 0 && missingFromDisk.Count == 0,
            BuildDriftMessage(
                "backend/Application", "CLAUDE.md:48's Application/<Feature>/Commands|Queries bullet",
                missingFromDocs, missingFromDisk));
    }

    [Fact]
    public void BackendTestsFolders_MatchClaudeMdList()
    {
        var claudeMd = File.ReadAllText(Path.Combine(RepoRoot(), "CLAUDE.md"));
        var documented = ExtractBackendTestsFolders(claudeMd);
        var actual = GetTopLevelFolderNames(Path.Combine(RepoRoot(), "backend.Tests"), "bin", "obj");

        var (missingFromDocs, missingFromDisk) = ComputeDrift(documented, actual);

        Assert.True(missingFromDocs.Count == 0 && missingFromDisk.Count == 0,
            BuildDriftMessage(
                "backend.Tests", "CLAUDE.md:55's backend.Tests/ bullet",
                missingFromDocs, missingFromDisk));
    }

    // Demonstrates the failure mode this issue guards against end-to-end — using a disposable
    // temp directory, never the real repo — without duplicating the production regexes.
    [Fact]
    public void Drift_IsDetected_WhenNewApplicationFolderAppearsWithoutUpdatingClaudeMd_AndClearsOnceDocsCatchUp()
    {
        var tempRoot = Directory.CreateTempSubdirectory("utanvega-claudemd-drift-");
        try
        {
            var appDir = Directory.CreateDirectory(Path.Combine(tempRoot.FullName, "backend", "Application"));
            foreach (var name in new[] { "Activities", "Analytics", "Caching" })
                Directory.CreateDirectory(Path.Combine(appDir.FullName, name));

            const string originalBullet =
                "- `Application/<Feature>/Commands|Queries` — MediatR handlers, one feature folder per domain concept (Activities, Analytics, Caching).";

            // Step 1: CLAUDE.md and disk agree — no drift.
            var documented = ExtractApplicationFeatureFolders(originalBullet);
            var actual = GetTopLevelFolderNames(appDir.FullName);
            var (missingFromDocs, missingFromDisk) = ComputeDrift(documented, actual);
            Assert.Empty(missingFromDocs);
            Assert.Empty(missingFromDisk);

            // Step 2: a new feature folder is added on disk without touching CLAUDE.md — drift
            // must be detected and must name the offending folder.
            Directory.CreateDirectory(Path.Combine(appDir.FullName, "NewFeature"));
            actual = GetTopLevelFolderNames(appDir.FullName);
            (missingFromDocs, missingFromDisk) = ComputeDrift(documented, actual);
            Assert.Equal(new[] { "NewFeature" }, missingFromDocs);
            Assert.Empty(missingFromDisk);

            // Step 3: updating CLAUDE.md's parenthetical list to include the new folder clears
            // the drift again.
            const string updatedBullet =
                "- `Application/<Feature>/Commands|Queries` — MediatR handlers, one feature folder per domain concept (Activities, Analytics, Caching, NewFeature).";
            documented = ExtractApplicationFeatureFolders(updatedBullet);
            (missingFromDocs, missingFromDisk) = ComputeDrift(documented, actual);
            Assert.Empty(missingFromDocs);
            Assert.Empty(missingFromDisk);
        }
        finally
        {
            tempRoot.Delete(recursive: true);
        }
    }
}
