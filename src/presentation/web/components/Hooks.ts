import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useBeforeUnload(shouldWarn: boolean) {
  const location = useLocation();

  useEffect(() => {
    if (!shouldWarn) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldWarn, location.pathname]);
}

export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — EcoTrack AI`;
    return () => { document.title = prev; };
  }, [title]);
}
