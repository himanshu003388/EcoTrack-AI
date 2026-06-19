import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useBeforeUnload(shouldWarn: boolean): void {
  const location = useLocation();

  useEffect(() => {
    if (!shouldWarn) return;

    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return (): void => window.removeEventListener('beforeunload', handler);
  }, [shouldWarn, location.pathname]);
}

export function usePageTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — EcoTrack AI`;
    return (): void => { document.title = prev; };
  }, [title]);
}
