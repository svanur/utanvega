import { useState } from 'react';
import { apiFetch } from './api';

interface TranslateResult {
    translations: string[];
}

/**
 * Translates an array of Icelandic strings to English via the backend DeepL endpoint.
 * Returns translated strings in the same order. Empty/null inputs pass through as empty strings.
 */
export function useTranslate() {
    const [translating, setTranslating] = useState(false);

    const translate = async (texts: (string | null | undefined)[]): Promise<string[]> => {
        const nonEmpty = texts.map(t => t?.trim() || '');
        const indices = nonEmpty.map((t, i) => t ? i : -1).filter(i => i >= 0);
        const toTranslate = indices.map(i => nonEmpty[i]);

        if (toTranslate.length === 0) return nonEmpty;

        setTranslating(true);
        try {
            const result = await apiFetch<TranslateResult>('/api/v1/admin/translate', {
                method: 'POST',
                body: JSON.stringify({ texts: toTranslate }),
            });
            const out = [...nonEmpty];
            indices.forEach((origIdx, translatedIdx) => {
                out[origIdx] = result.translations[translatedIdx] ?? '';
            });
            return out;
        } finally {
            setTranslating(false);
        }
    };

    return { translate, translating };
}
