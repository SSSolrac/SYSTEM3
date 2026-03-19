import { useEffect } from 'react';

export function ThemeInitializer() {
  useEffect(() => {
    // Force light look as requested.
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  return null;
}

