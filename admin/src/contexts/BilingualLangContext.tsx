import { useState, type ReactNode } from 'react';
import { BilingualLangContext } from '../hooks/useBilingualLang';

export function BilingualLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<'is' | 'en'>('is');
  const toggle = () => setLangState(l => l === 'is' ? 'en' : 'is');
  const setLang = (l: 'is' | 'en') => setLangState(l);
  return (
    <BilingualLangContext.Provider value={{ lang, toggle, setLang }}>
      {children}
    </BilingualLangContext.Provider>
  );
}
