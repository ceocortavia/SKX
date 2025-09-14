"use client";

import { useEffect, useState } from "react";

type Theme = 'system' | 'light' | 'dark';
type Lang = 'nb' | 'en';

const THEME_KEY = 'pref.theme';
const LANG_KEY = 'pref.lang';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveDark = theme === 'system' ? prefersDark : theme === 'dark';
  root.classList.toggle('dark', effectiveDark);
}

export default function PreferencesCard() {
  const [theme, setTheme] = useState<Theme>('system');
  const [lang, setLang] = useState<Lang>('nb');

  useEffect(() => {
    const t = (localStorage.getItem(THEME_KEY) as Theme) || 'system';
    const l = (localStorage.getItem(LANG_KEY) as Lang) || 'nb';
    setTheme(t);
    setLang(l);
    applyTheme(t);
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="text-sm text-gray-500">Preferanser</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Tema</span>
          <select className="rounded-lg border px-3 py-2 text-sm" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="system">System</option>
            <option value="light">Lyst</option>
            <option value="dark">Mørkt</option>
          </select>
          <span className="text-xs text-gray-500">Lagrer lokalt i nettleseren.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Språk</span>
          <select className="rounded-lg border px-3 py-2 text-sm" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="nb">Norsk</option>
            <option value="en">English</option>
          </select>
          <span className="text-xs text-gray-500">Oppdaterer document.lang.</span>
        </label>
      </div>
    </div>
  );
}


