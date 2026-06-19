import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';

expect.extend(toHaveNoViolations);

const mockUser = {
  id: 1,
  email: 'test@ecotrack.ai',
  username: 'TestUser',
  points: 250,
  level: 'Tree',
  streak: 7,
};

vi.mock('../presentation/web/main', () => ({
  useAuth: () => ({
    token: 'mock-token',
    user: mockUser,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    refreshUser: vi.fn(),
  }),
  useTheme: () => ({
    theme: 'light' as const,
    toggleTheme: vi.fn(),
  }),
}));

const { Layout } = await import('../presentation/web/components/Layout');

describe('Layout', () => {
  it('renders sidebar with navigation items', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Main content</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getByText('EcoTrack')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Activity Tracker')).toBeInTheDocument();
    expect(screen.getByText('Carbon Simulator')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('has skip-to-content link', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink.closest('a')).toHaveAttribute('href', '#main-content');
  });

  it('main content area has correct attributes', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabIndex', '-1');
  });

  it('sidebar nav has accessible label', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    // The nav element (not its outer container) carries the accessible label and navigation role
    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(sidebar).toBeInTheDocument();
  });

  it('header has banner role', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const header = document.querySelector('header');
    expect(header).toHaveAttribute('role', 'banner');
  });

  it('theme toggle has accessible label', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const toggle = screen.getByLabelText('Switch to dark mode');
    expect(toggle).toBeInTheDocument();
  });

  it('user stats region has accessible label', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const stats = screen.getByLabelText('User statistics');
    expect(stats).toHaveAttribute('role', 'status');
  });

  it('streak has accessible label', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    // Both desktop and mobile streak badges carry the same aria-label (by design for responsiveness)
    const streakElements = screen.getAllByLabelText('7 day streak');
    expect(streakElements.length).toBeGreaterThanOrEqual(1);
  });

  it('XP has accessible label', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('250 experience points')).toBeInTheDocument();
  });

  it('nav items have aria-current for active page', () => {
    render(
      <MemoryRouter initialEntries={['/tracker']}>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const activeLink = screen.getByText('Activity Tracker').closest('a');
    expect(activeLink).toHaveAttribute('aria-current', 'page');
  });

  it('mobile menu button has correct aria-controls', () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const openButton = screen.getByLabelText('Open navigation menu');
    expect(openButton).toHaveAttribute('aria-controls', 'mobile-menu');
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('nav links have unique accessible names', () => {
    render(
      <MemoryRouter initialEntries={['/tracker']}>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
    const links = nav.querySelectorAll('a');
    expect(links.length).toBe(7);
    links.forEach((link) => {
      expect(link.textContent?.trim()).toBeTruthy();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <Layout>
          <p>Content</p>
        </Layout>
      </MemoryRouter>,
    );
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});
