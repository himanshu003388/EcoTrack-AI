import React, { useState, memo, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth, useTheme } from '../main';
import { useFocusMainOnNav } from './Hooks';
import {
  LayoutDashboard,
  CalendarCheck,
  Sliders,
  TrendingUp,
  MessageSquareText,
  Trophy,
  FileBarChart2,
  Menu,
  X,
  Flame,
  Leaf,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Activity Tracker', to: '/tracker', icon: CalendarCheck },
  { name: 'Carbon Simulator', to: '/simulator', icon: Sliders },
  { name: 'Emission Forecast', to: '/forecast', icon: TrendingUp },
  { name: 'Eco Coach', to: '/coach', icon: MessageSquareText },
  { name: 'Eco Challenges', to: '/challenges', icon: Trophy },
  { name: 'Carbon Reports', to: '/reports', icon: FileBarChart2 },
];

function getLevelColor(level: string): string {
  switch (level) {
    case 'Climate Hero':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700';
    case 'Forest Guardian':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700';
    case 'Tree':
      return 'bg-forest-100 text-forest-700 border-forest-200 dark:bg-forest-800/40 dark:text-forest-300 dark:border-forest-700';
    case 'Sapling':
      return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700';
    default:
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700';
  }
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <>
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-slate-100 dark:border-forest-800 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-500 glow-logo-container">
          <Leaf className="h-4 w-4 text-white fill-white/20" aria-hidden="true" />
        </div>
        <span className="font-display text-lg font-bold tracking-tight text-forest-500 glow-green">EcoTrack</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.name}
              to={item.to}
              onClick={onNavClick}
              style={{ animationDelay: `${i * 30}ms` }}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 list-stagger ${
                isActive
                  ? 'bg-forest-500 text-white shadow-sm shadow-forest-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-forest-800/60 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {user && (
        <div className="p-3 border-t border-slate-100 dark:border-forest-800 shrink-0">
          <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-forest-900/60 rounded-2xl border border-slate-100 dark:border-forest-800">
            <div
              className="flex items-center justify-center h-9 w-9 rounded-full bg-forest-500 text-white font-bold font-display text-sm shrink-0"
              aria-hidden="true"
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.username}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[10px] px-1.5 py-0.5 border rounded-full font-bold ${getLevelColor(user.level)}`}
                >
                  {user.level}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const Layout: React.FC<LayoutProps> = memo(({ children }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef(0);

  useFocusMainOnNav();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Focus trap and focus management for mobile drawer
  useEffect(() => {
    if (!mobileMenuOpen) {
      // Restore focus to the trigger button when the drawer closes
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
      return;
    }

    const drawer = drawerRef.current;
    if (!drawer) return;

    // Focus the first focusable element inside the drawer
    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      // Short delay to allow animation to start and avoid focus theft
      setTimeout(() => {
        firstFocusable.focus();
      }, 50);
    }

    const handleFocusTrap = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;

      const focusables = drawer.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (firstElement && lastElement) {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleFocusTrap);
    return (): void => {
      document.removeEventListener('keydown', handleFocusTrap);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return (): void => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    if (touch) {
      touchStartX.current = touch.clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent): void => {
    if (touchStartX.current > 100) return;
    const touch = e.touches[0];
    if (touch) {
      const diff = touch.clientX - touchStartX.current;
      if (diff > 80 && !mobileMenuOpen) {
        setMobileMenuOpen(true);
      }
    }
  };

  const handleDrawerTouchEnd = (e: React.TouchEvent): void => {
    const touch = e.changedTouches[0];
    if (touch) {
      const diff = touch.clientX - touchStartX.current;
      if (diff < -80) {
        setMobileMenuOpen(false);
      }
    }
  };

  return (
    <>
      <a href="#main-content" className="skip-link" aria-label="Skip to main content and continue using keyboard">
        Skip to main content
      </a>
      <div
        className="flex h-screen overflow-hidden bg-slate-50 dark:bg-forest-950 font-sans transition-colors duration-200"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className="hidden md:flex md:w-60 md:flex-col bg-white dark:bg-forest-900 border-r border-slate-100 dark:border-forest-800 shrink-0 transition-colors duration-200">
          <SidebarContent />
        </div>

        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <header
            className="flex items-center justify-between h-16 px-4 bg-white/80 dark:bg-forest-900/80 backdrop-blur-md border-b border-slate-100 dark:border-forest-800 md:px-8 sticky top-0 z-30 transition-colors duration-200"
            role="banner"
          >
            <div className="flex items-center gap-2">
              <button
                ref={triggerRef}
                onClick={() => setMobileMenuOpen(true)}
                className="btn-press p-2.5 -ml-2 rounded-lg md:hidden text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-forest-800 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-1.5 md:hidden" aria-hidden="true">
                <Leaf className="h-5 w-5 text-forest-500" />
              </div>
              <div aria-live="polite" aria-atomic="true" className="sr-only" id="nav-announcement"></div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="btn-press p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-forest-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              {user && (
                <div className="flex items-center gap-3" role="status" aria-label="User statistics">
                  <div
                    className="hidden sm:flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-full text-xs font-semibold"
                    aria-label={`${user.streak} day streak`}
                  >
                    <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" aria-hidden="true" />
                    <span className="tabular-nums">{user.streak} day streak</span>
                  </div>

                  <div
                    className="hidden sm:flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800 text-sky-800 dark:text-sky-300 px-3 py-1.5 rounded-full text-xs font-semibold"
                    aria-label={`${user.points} experience points`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
                    <span className="tabular-nums">{user.points} XP</span>
                  </div>

                  <div
                    className="flex sm:hidden items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-forest-800 px-2.5 py-1.5 rounded-full"
                    aria-label={`${user.streak} day streak`}
                  >
                    <Flame className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                    <span className="tabular-nums">{user.streak}</span>
                  </div>
                </div>
              )}
            </div>
          </header>

          <div aria-live="polite" aria-atomic="true" className="sr-only" id="a11y-announcements"></div>
          <main
            id="main-content"
            className="flex-1 relative overflow-y-auto focus:outline-none p-4 md:p-8 animate-fade-in"
            role="main"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            aria-describedby="mobile-menu-desc"
          >
            <span id="mobile-menu-desc" className="sr-only">
              Use tab to navigate menu items. Press Escape to close.
            </span>
            <div
              className="fixed inset-0 bg-slate-600/30 dark:bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            ></div>
            <div
              ref={drawerRef}
              id="mobile-menu"
              className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-forest-900 flex flex-col z-50 border-r border-slate-100 dark:border-forest-800 shadow-2xl animate-slide-in-right"
              onTouchEnd={handleDrawerTouchEnd}
            >
              <div className="flex items-center justify-between px-4 h-16 border-b border-slate-100 dark:border-forest-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-500 glow-logo-container">
                    <Leaf className="h-4 w-4 text-white" aria-hidden="true" />
                  </div>
                  <span className="font-display text-lg font-bold tracking-tight text-forest-500 glow-green">
                    EcoTrack
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-press p-2.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-forest-800 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <SidebarContent onNavClick={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </>
  );
});
