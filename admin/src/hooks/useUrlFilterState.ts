import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Schema describing one URL-persisted filter/sort field. `default` doubles as the fallback
 * for both an absent param and an unrecognized one (e.g. a stale bookmark or hand-edited URL),
 * so callers never need to guard against invalid state themselves.
 *
 * Omit `allowed` for freeform text (search boxes) or values whose valid set is only known once
 * data has loaded (e.g. location names) — those are passed through unvalidated.
 */
export interface UrlFieldSchema<T extends string> {
  default: T;
  allowed?: readonly T[];
}

export type UrlSchemaMap = Record<string, UrlFieldSchema<string>>;

// A field's value type is the union of its `allowed` literals (plus `default`, in case a
// sentinel default like '' is deliberately excluded from `allowed`) when given — a
// finite-domain filter, e.g. status/sort enums — or plain `string` when `allowed` is omitted
// (freeform search text, or a domain only known once data has loaded, e.g. location names).
// Using `default`'s own (necessarily narrower) literal type alone here would make every other
// allowed value a TS error at the comparison sites that consume it.
type FieldValue<F extends UrlFieldSchema<string>> = F extends { allowed: readonly (infer U)[] } ? U | F['default'] : string;

type SchemaValues<S extends UrlSchemaMap> = { [K in keyof S]: FieldValue<S[K]> };

/**
 * Backs a list page's filter/sort state with the URL's query string instead of component
 * state. Filters survive navigating to a detail page and back (they're just history), but
 * reset to schema defaults on a fresh mount with no query params — e.g. arriving via the
 * sidebar or a bookmarked link.
 *
 * All updates use history `replace`: filter changes (including search-box keystrokes) must
 * never pile up back-button stops the way a `push` per keystroke would.
 */
export function useUrlFilterState<S extends UrlSchemaMap>(schema: S) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const result = {} as SchemaValues<S>;
    for (const key of Object.keys(schema) as (keyof S & string)[]) {
      const field = schema[key];
      const raw = searchParams.get(key);
      const isValid = raw != null && (!field.allowed || (field.allowed as readonly string[]).includes(raw));
      result[key] = (isValid ? raw : field.default) as SchemaValues<S>[typeof key];
    }
    return result;
  }, [searchParams, schema]);

  // Writes accept plain strings rather than each field's narrowed read-side type: the source
  // is usually a DOM/MUI change event (`e.target.value` is always `string`), and an invalid
  // write is harmless — the next render's `values` computation falls back to the default the
  // same way a hand-edited URL would.
  const setValues = useCallback((partial: Partial<Record<keyof S & string, string>>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const key of Object.keys(partial) as (keyof S & string)[]) {
        const value = partial[key];
        if (value == null || value === schema[key].default) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [schema, setSearchParams]);

  const setValue = useCallback(<K extends keyof S & string>(key: K, value: string) => {
    setValues({ [key]: value } as Partial<Record<keyof S & string, string>>);
  }, [setValues]);

  // Clears every field this schema owns back to its default, leaving any unrelated query
  // params (there shouldn't be any in practice) untouched.
  const reset = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const key of Object.keys(schema)) next.delete(key);
      return next;
    }, { replace: true });
  }, [schema, setSearchParams]);

  return { values, setValue, setValues, reset };
}
