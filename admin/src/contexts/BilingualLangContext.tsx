import { createContext, useContext, useState, type ReactNode } from 'react';

interface BilingualLangContextValue {
  lang: 'is' | 'en';
  toggle: () => void;
  setLang: (l: 'is' | 'en') => void;
}

const BilingualLangContext = createContext<BilingualLangContextValue | null>(null);

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

export function useBilingualLang() {
  const context = useContext(BilingualLangContext);
  if (context === null) {
    throw new Error('useBilingualLang must be used within a BilingualLangProvider');
  }
  return context;
}
