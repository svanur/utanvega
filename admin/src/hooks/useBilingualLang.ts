import { createContext, useContext } from 'react';

export interface BilingualLangContextValue {
  lang: 'is' | 'en';
  toggle: () => void;
  setLang: (l: 'is' | 'en') => void;
}

// Lives here (not in BilingualLangContext.tsx) so that file exports only the
// BilingualLangProvider component — react-refresh/only-export-components requires a
// component file not to also export non-component values like a hook or a raw Context.
export const BilingualLangContext = createContext<BilingualLangContextValue | null>(null);

export function useBilingualLang() {
  const context = useContext(BilingualLangContext);
  if (context === null) {
    throw new Error('useBilingualLang must be used within a BilingualLangProvider');
  }
  return context;
}
