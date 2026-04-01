const icelandicMap: Record<string, string> = {
    'á': 'a', 'Á': 'a',
    'é': 'e', 'É': 'e',
    'í': 'i', 'Í': 'i',
    'ó': 'o', 'Ó': 'o',
    'ú': 'u', 'Ú': 'u',
    'ý': 'y', 'Ý': 'y',
    'þ': 'th', 'Þ': 'th',
    'æ': 'ae', 'Æ': 'ae',
    'ö': 'o', 'Ö': 'o',
    'ð': 'd', 'Ð': 'd',
};

/**
 * Generates a URL-friendly slug from a name.
 * Mirrors the backend SlugGenerator logic.
 */
export function generateSlug(name: string): string {
    if (!name || !name.trim()) return '';

    let slug = Array.from(name)
        .map(c => icelandicMap[c] ?? c)
        .join('')
        .toLowerCase();

    // Replace spaces, underscores, dots with dashes
    slug = slug.replace(/[\s_.]+/g, '-');

    // Keep only alphanumeric and dashes
    slug = slug.replace(/[^a-z0-9-]/g, '');

    // Collapse consecutive dashes
    slug = slug.replace(/-{2,}/g, '-');

    // Trim leading/trailing dashes
    slug = slug.replace(/^-+|-+$/g, '');

    return slug;
}
