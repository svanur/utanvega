import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Back-to-list click handler shared by the detail pages (trails/events/organizers/
 * photographers). Prefer navigate(-1) so the list's filter/sort/search state (kept in its
 * URL query string) is restored — matches the 'u' shortcut and the browser back button.
 * Falls back to `fallbackPath` when there's no prior in-app history entry to pop to (e.g.
 * this page was opened directly from a bookmark or shared link).
 *
 * `window.history.state?.idx` is a react-router-dom internal, not a public API — it's read
 * only here so a future react-router upgrade only needs a fix in one place.
 */
export function useBackToList(fallbackPath: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  }, [navigate, fallbackPath]);
}
