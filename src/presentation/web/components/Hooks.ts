import { useEffect, useRef } from 'react';
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

const PAGE_TITLE_SUFFIX = ' — EcoTrack AI';

export function usePageTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title}${PAGE_TITLE_SUFFIX}`;
    return (): void => {
      document.title = prev;
    };
  }, [title]);
}

export function useRouteAnnounce(): void {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    const el = document.getElementById('a11y-announcements');
    if (!el) return;

    const pageNames: Record<string, string> = {
      '/': 'Carbon Intelligence Dashboard',
      '/tracker': 'Activity Tracker',
      '/simulator': 'Carbon Reduction Simulator',
      '/forecast': 'Emission Forecast',
      '/coach': 'Eco Coach AI',
      '/challenges': 'Eco Challenges and Achievements',
      '/reports': 'Carbon Reports and Impact Card',
    };

    const name = pageNames[location.pathname] ?? 'Page';
    el.textContent = `Navigated to ${name}`;
  }, [location.pathname]);
}

export function useFocusMainOnNav(): void {
  const location = useLocation();

  useEffect(() => {
    requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      if (main) {
        const skipLink = document.querySelector('.skip-link');
        if (skipLink && document.activeElement === skipLink) return;
        main.focus({ preventScroll: true });
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  }, [location.pathname]);
}
