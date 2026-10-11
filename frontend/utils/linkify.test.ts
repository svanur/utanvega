import { describe, it, expect } from 'vitest';
import { tokenizeLinks } from './linkify';

describe('tokenizeLinks (#1072)', () => {
    it('renders plain text with no URLs unchanged -- a single text token identical to the input', () => {
        const text = 'Bring water and good shoes.\nThe trail is rocky in places.';
        expect(tokenizeLinks(text)).toEqual([{ type: 'text', value: text }]);
    });

    it('returns an empty array for an empty string', () => {
        expect(tokenizeLinks('')).toEqual([]);
    });

    it('links a bare https URL, leaving surrounding text unchanged', () => {
        const text = 'Check out https://example.com/path for details.';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'text', value: 'Check out ' },
            { type: 'link', label: 'https://example.com/path', url: 'https://example.com/path' },
            { type: 'text', value: ' for details.' },
        ]);
    });

    it('links a bare http URL too, not just https', () => {
        const text = 'Old site: http://example.org';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'text', value: 'Old site: ' },
            { type: 'link', label: 'http://example.org', url: 'http://example.org' },
        ]);
    });

    it('renders a markdown-style link as its label, not the raw syntax or the raw URL', () => {
        const text = '[Register here](https://example.com/register)';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'link', label: 'Register here', url: 'https://example.com/register' },
        ]);
    });

    it('excludes a trailing sentence period from the link, keeping it as separate plain text', () => {
        const text = 'See https://example.com/page.';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'text', value: 'See ' },
            { type: 'link', label: 'https://example.com/page', url: 'https://example.com/page' },
            { type: 'text', value: '.' },
        ]);
    });

    it('excludes a trailing comma from the link', () => {
        const text = 'Visit https://example.com/page, then sign up.';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'text', value: 'Visit ' },
            { type: 'link', label: 'https://example.com/page', url: 'https://example.com/page' },
            { type: 'text', value: ', then sign up.' },
        ]);
    });

    it('excludes an unbalanced closing paren that belongs to the enclosing sentence', () => {
        const text = '(see https://example.com/page)';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'text', value: '(see ' },
            { type: 'link', label: 'https://example.com/page', url: 'https://example.com/page' },
            { type: 'text', value: ')' },
        ]);
    });

    it('keeps a balanced paren that is part of the URL path itself', () => {
        const text = 'https://en.wikipedia.org/wiki/Foo_(bar)';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'link', label: text, url: text },
        ]);
    });

    it('treats a disallowed-scheme markdown link as plain, inert text', () => {
        const text = '[click](javascript:alert(1))';
        const tokens = tokenizeLinks(text);
        expect(tokens.every(tok => tok.type === 'text')).toBe(true);
        expect(tokens.map(tok => (tok.type === 'text' ? tok.value : '')).join('')).toBe(text);
    });

    it('treats any bare non-http(s) candidate as plain, inert text', () => {
        const text = 'Email mailto:someone@example.com for help.';
        const tokens = tokenizeLinks(text);
        expect(tokens.every(tok => tok.type === 'text')).toBe(true);
        expect(tokens.map(tok => (tok.type === 'text' ? tok.value : '')).join('')).toBe(text);
    });

    it('detects a markdown link and a separate bare URL independently in the same text', () => {
        const text = 'Visit [our site](https://example.com) or https://backup.example.com directly.';
        expect(tokenizeLinks(text)).toEqual([
            { type: 'text', value: 'Visit ' },
            { type: 'link', label: 'our site', url: 'https://example.com' },
            { type: 'text', value: ' or ' },
            { type: 'link', label: 'https://backup.example.com', url: 'https://backup.example.com' },
            { type: 'text', value: ' directly.' },
        ]);
    });

    it('preserves newlines in plain text so `whiteSpace: pre-line` styling keeps working', () => {
        const text = 'Line one\nLine two with https://example.com link\nLine three';
        const tokens = tokenizeLinks(text);
        expect(tokens[0]).toEqual({ type: 'text', value: 'Line one\nLine two with ' });
        expect(tokens[1]).toEqual({ type: 'link', label: 'https://example.com', url: 'https://example.com' });
        expect(tokens[2]).toEqual({ type: 'text', value: ' link\nLine three' });
    });
});
