/**
 * Turns a free-text description/notes field into a sequence of plain-text and link tokens, so a
 * renderer can turn `[label](url)` markdown-style links and bare `http(s)://` URLs into clickable
 * `<a>` tags while leaving everything else as plain, React-escaped text (#1072).
 *
 * Deliberately returns data, not JSX -- this file stays a `.ts` (not `.tsx`) so the tokenizer is
 * importable and unit-testable from plain Node/vitest without a DOM, same as calendarLinks.ts.
 * The React-facing renderer that maps these tokens to `<a>` elements lives in a sibling `.tsx`
 * component instead (components/LinkifiedText.tsx) -- see getActivityIcon.tsx's comment for why a
 * component file that also exports a plain function trips react-refresh/only-export-components.
 */

export type LinkToken =
    | { type: 'text'; value: string }
    | { type: 'link'; label: string; url: string };

// Same scheme-validation rule as toYoutubeEmbedUrl (TrailDetailsPage.tsx): only a candidate that
// parses as an absolute URL *and* uses http/https may ever become a clickable href. Anything else
// -- javascript:, mailto:, a bare "www.example.com" with no scheme, or garbage that doesn't parse
// at all -- is rejected and falls back to inert plain text.
function isLinkableUrl(candidate: string): boolean {
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// Trailing punctuation that almost always belongs to the surrounding sentence, not the URL
// itself (e.g. "See https://example.com." -- the period ends the sentence, not the path).
const TRAILING_PUNCTUATION = /[.,;:!?'"”’]+$/;

/**
 * Strips trailing sentence punctuation, and an unbalanced trailing ')' or ']', off a bare URL
 * candidate -- e.g. "(see https://example.com/page)" should link just the URL, not the closing
 * paren that belongs to the enclosing sentence. A *balanced* paren inside the URL itself (as in
 * a Wikipedia-style "/wiki/Foo_(bar)" path) is left alone.
 */
function splitTrailingPunctuation(candidate: string): { url: string; trailing: string } {
    let url = candidate;
    let trailing = '';

    for (;;) {
        const punctuationMatch = url.match(TRAILING_PUNCTUATION);
        if (punctuationMatch) {
            trailing = punctuationMatch[0] + trailing;
            url = url.slice(0, -punctuationMatch[0].length);
            continue;
        }

        const last = url[url.length - 1];
        if (last === ')' || last === ']') {
            const open = last === ')' ? '(' : '[';
            const openCount = (url.match(new RegExp(`\\${open}`, 'g')) ?? []).length;
            const closeCount = (url.match(new RegExp(`\\${last}`, 'g')) ?? []).length;
            if (closeCount > openCount) {
                trailing = last + trailing;
                url = url.slice(0, -1);
                continue;
            }
        }

        break;
    }

    return { url, trailing };
}

/** Pass 2: auto-detect bare http(s) URLs within a plain-text segment (one with no markdown links left). */
function tokenizeBareUrls(text: string): LinkToken[] {
    const tokens: LinkToken[] = [];
    const bareUrl = /https?:\/\/[^\s]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = bareUrl.exec(text)) !== null) {
        const raw = match[0];
        const { url, trailing } = splitTrailingPunctuation(raw);

        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }

        if (url && isLinkableUrl(url)) {
            tokens.push({ type: 'link', label: url, url });
            if (trailing) tokens.push({ type: 'text', value: trailing });
        } else {
            tokens.push({ type: 'text', value: raw });
        }

        lastIndex = match.index + raw.length;
    }

    if (lastIndex < text.length) {
        tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return tokens;
}

/** Pass 1: extract `[label](url)` markdown-style links; everything else is handed to pass 2. */
function tokenizeMarkdownLinks(text: string): LinkToken[] {
    const tokens: LinkToken[] = [];
    const markdownLink = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = markdownLink.exec(text)) !== null) {
        const [raw, label, url] = match;

        if (match.index > lastIndex) {
            tokens.push(...tokenizeBareUrls(text.slice(lastIndex, match.index)));
        }

        if (isLinkableUrl(url)) {
            tokens.push({ type: 'link', label, url });
        } else {
            // Disallowed scheme (javascript:, etc.) or something that doesn't parse as a URL at
            // all -- keep the raw "[label](url)" source as inert plain text rather than quietly
            // dropping the brackets or, worse, linking it anyway.
            tokens.push(...tokenizeBareUrls(raw));
        }

        lastIndex = match.index + raw.length;
    }

    if (lastIndex < text.length) {
        tokens.push(...tokenizeBareUrls(text.slice(lastIndex)));
    }

    return tokens;
}

function mergeAdjacentText(tokens: LinkToken[]): LinkToken[] {
    const merged: LinkToken[] = [];
    for (const token of tokens) {
        const prev = merged[merged.length - 1];
        if (token.type === 'text' && prev?.type === 'text') {
            prev.value += token.value;
        } else {
            merged.push({ ...token });
        }
    }
    return merged;
}

/**
 * Tokenizes `text` into plain-text and link segments: markdown-style `[label](url)` links first,
 * then bare `http(s)://` URLs in whatever plain text is left. Every candidate URL from either pass
 * is validated via `isLinkableUrl` (`new URL()` + protocol check) -- a candidate that fails stays
 * (or becomes) plain text, never a link. Concatenating every token's rendered text back together
 * (link tokens contribute their label) always reconstructs the original string, so a description
 * with no URLs at all comes back as a single unchanged text token.
 */
export function tokenizeLinks(text: string): LinkToken[] {
    if (!text) return [];
    return mergeAdjacentText(tokenizeMarkdownLinks(text));
}
