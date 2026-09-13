import { describe, it, expect } from 'vitest';
import { filterChangelogVersions, getAllChangelogTags, type ChangelogTagsMap, type ResolvedText } from './changelogDiary';

describe('getAllChangelogTags', () => {
    it('returns the deduplicated, flattened list of tags across all versions', () => {
        const tags: ChangelogTagsMap = {
            v1_6_0: ['admin', 'registrationOpens'],
            v1_5_0: ['admin', 'bugfix'],
        };
        expect(getAllChangelogTags(tags).sort()).toEqual(['admin', 'bugfix', 'registrationOpens'].sort());
    });

    it('omits versions with no tags entry without throwing', () => {
        const tags: ChangelogTagsMap = { v1_6_0: ['admin'], v1_5_0: undefined };
        expect(getAllChangelogTags(tags)).toEqual(['admin']);
    });

    it('returns an empty array for an empty map', () => {
        expect(getAllChangelogTags({})).toEqual([]);
    });
});

describe('filterChangelogVersions', () => {
    const versions = ['v1_2_0', 'v1_1_0', 'v1_0_0'];
    const tagsByVersion: ChangelogTagsMap = {
        v1_2_0: ['admin', 'registrationOpens'],
        v1_1_0: ['registrationCloses'],
        // v1_0_0 has no tags entry, matching real historical versions.
    };
    const text: Record<string, ResolvedText> = {
        v1_2_0: { title: 'Admin dashboard', description: 'New tools for organizers' },
        v1_1_0: { title: 'Registration', description: 'Closing dates now shown' },
        v1_0_0: { title: 'Launch', description: 'The site went live, mentioning Admin panel in passing' },
    };
    const resolveText = (key: string): ResolvedText => text[key];

    it('OR-matches across two active tags', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, ['admin', 'registrationCloses'], '', resolveText);
        expect(result).toEqual(['v1_2_0', 'v1_1_0']);
    });

    it('ANDs an active tag with search text — a tag match with no text match is excluded', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, ['admin'], 'launch', resolveText);
        expect(result).toEqual([]);
    });

    it('ANDs an active tag with search text — a tag match with a text match is included', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, ['admin'], 'dashboard', resolveText);
        expect(result).toEqual(['v1_2_0']);
    });

    it('matches search text case-insensitively', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, [], 'ADMIN DASHBOARD', resolveText);
        expect(result).toEqual(['v1_2_0']);
    });

    it('matches search text found only in the description, not the title', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, [], 'admin panel', resolveText);
        expect(result).toEqual(['v1_0_0']);
    });

    it('returns all versions when both active tags and search text are empty', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, [], '', resolveText);
        expect(result).toEqual(versions);
    });

    it('returns an empty array when the filter combination matches nothing', () => {
        const result = filterChangelogVersions(versions, tagsByVersion, ['admin'], 'nonexistent search term', resolveText);
        expect(result).toEqual([]);
    });
});
