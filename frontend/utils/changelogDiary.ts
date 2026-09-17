// Extracted from ChangelogDiaryPage's inline useMemos (#790) for unit-test coverage. The only
// non-pure dependency in the original logic was `t()`, used to resolve the current-language
// title/description for text search — callers pass that in as `resolveText` instead, keeping this
// module framework-independent.

export type ChangelogTagsMap = Partial<Record<string, string[]>>;

export interface ResolvedText {
    title: string;
    description: string;
}

// Derived from the values actually present in a tags map, not a second hardcoded list — a new tag
// on a future version becomes filterable on its own.
export function getAllChangelogTags(tagsByVersion: ChangelogTagsMap): string[] {
    return Array.from(new Set(Object.values(tagsByVersion).flatMap(tags => tags ?? [])));
}

export function filterChangelogVersions(
    versions: string[],
    tagsByVersion: ChangelogTagsMap,
    activeTags: string[],
    searchText: string,
    resolveText: (key: string) => ResolvedText,
): string[] {
    const search = searchText.trim().toLowerCase();
    return versions.filter(key => {
        const tags = tagsByVersion[key] ?? [];
        const matchesTags = activeTags.length === 0 || tags.some(tag => activeTags.includes(tag));
        if (!matchesTags) return false;
        if (!search) return true;
        const { title, description } = resolveText(key);
        return title.toLowerCase().includes(search) || description.toLowerCase().includes(search);
    });
}
