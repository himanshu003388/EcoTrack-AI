import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../presentation/web/components/Toast';

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

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  LineChart: () => null,
  Line: () => null,
}));

vi.stubGlobal('fetch', vi.fn());

function renderWithProviders(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </ToastProvider>
  );
}


describe('Dashboard page accessibility', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async (url: any) => {
      if (url.toString().includes('/api/actions/daily')) {
        return {
          ok: true, json: () => Promise.resolve({
            action: { title: 'Walk instead of drive', description: 'A short walk reduces emissions.', difficulty: 'Easy', duration: '5 min', co2Saving: '0.5 kg', link: 'https://example.com' },
            reason: 'Short car trips produce disproportionate emissions.',
          }),
        } as any;
      }
      return {
        ok: true, json: () => Promise.resolve({
          sustainabilityScore: 65, emissions: { today: 12, monthly: 180, annualProjection: 2190 },
          userStats: { level: 'Tree' },
          equivalents: { treesNeeded: 8, carKm: 1000, electricityHours: 480, phoneCharges: 21687 },
          categoryBreakdown: [{ category: 'transport', emissions: 80, percentage: 44 }, { category: 'food', emissions: 50, percentage: 28 }],
          trends: [{ date: '2025-01-01', emissions: 12 }],
          averages: { nationalDaily: 25, globalDaily: 15, sustainableDaily: 5.5 },
          explanation: 'Test.', currentGoal: { targetCo2: 200, achieved: false, endDate: new Date().toISOString() },
        }),
      } as any;
    });
  });

  it('has proper heading', async () => {
    const { Dashboard } = await import('../presentation/web/pages/Dashboard');
    renderWithProviders(<Dashboard />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Carbon Intelligence Dashboard');
  });

  it('has region for quick actions', async () => {
    const { Dashboard } = await import('../presentation/web/pages/Dashboard');
    renderWithProviders(<Dashboard />);
    await waitFor(async () => {
      expect(await screen.findByLabelText('Quick actions to reduce your footprint')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { Dashboard } = await import('../presentation/web/pages/Dashboard');
    const { container } = renderWithProviders(<Dashboard />);
    await screen.findByRole('heading', { level: 1 });
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('Simulator page accessibility', () => {
  it('has proper heading', async () => {
    const { Simulator } = await import('../presentation/web/pages/Simulator');
    renderWithProviders(<Simulator />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Carbon Reduction Simulator');
  });

  it('sliders have labels', async () => {
    const { Simulator } = await import('../presentation/web/pages/Simulator');
    renderWithProviders(<Simulator />);
    expect(screen.getByLabelText('Weekly Car Commute slider')).toBeInTheDocument();
    expect(screen.getByLabelText('Weekly Public Transit slider')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { Simulator } = await import('../presentation/web/pages/Simulator');
    const { container } = renderWithProviders(<Simulator />);
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('Coach page accessibility', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: () => Promise.resolve({ reply: 'Test reply', insights: ['Tip 1'], suggestions: ['Ask more'] }),
    } as any);
  });

  it('has accessible chat section', async () => {
    const { Coach } = await import('../presentation/web/pages/Coach');
    renderWithProviders(<Coach />);
    expect(screen.getByLabelText('AI Eco Coach Chat')).toBeInTheDocument();
  });

  it('chat input has label', async () => {
    const { Coach } = await import('../presentation/web/pages/Coach');
    renderWithProviders(<Coach />);
    expect(screen.getByLabelText('Ask your Eco Coach a question')).toBeInTheDocument();
  });

  it('message region has aria-live attribute', async () => {
    const { Coach } = await import('../presentation/web/pages/Coach');
    renderWithProviders(<Coach />);
    const logRegion = screen.getByLabelText('Chat messages');
    expect(logRegion).toHaveAttribute('aria-live', 'polite');
    expect(logRegion).toHaveAttribute('role', 'log');
  });

  it('has no accessibility violations', async () => {
    const { Coach } = await import('../presentation/web/pages/Coach');
    const { container } = renderWithProviders(<Coach />);
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('Challenges page accessibility', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: () => Promise.resolve({
        challenges: [{ id: 1, title: 'Reduce Transport', category: 'transport', description: 'Test desc', pointsReward: 50, co2Target: 20, durationDays: 7 }],
        joined: [],
      }),
    } as any);
  });

  it('has proper heading', async () => {
    const { Challenges } = await import('../presentation/web/pages/Challenges');
    renderWithProviders(<Challenges />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Eco Challenges & Achievements');
  });

  it('has no accessibility violations', async () => {
    const { Challenges } = await import('../presentation/web/pages/Challenges');
    const { container } = renderWithProviders(<Challenges />);
    await screen.findByRole('heading', { level: 1 });
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('ForecastPage accessibility', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: () => Promise.resolve({
        nextMonthEstimate: 320, trendDirection: 'increasing', trendPercentage: 15,
        goalAchievementProbability: 45, riskAreas: [{ category: 'transport', message: 'High' }],
        improvementOpportunities: ['Use transit more'],
      }),
    } as any);
  });

  it('has proper heading', async () => {
    const { ForecastPage } = await import('../presentation/web/pages/ForecastPage');
    renderWithProviders(<ForecastPage />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Future Emission Forecast');
  });

  it('has no accessibility violations', async () => {
    const { ForecastPage } = await import('../presentation/web/pages/ForecastPage');
    const { container } = renderWithProviders(<ForecastPage />);
    await screen.findByRole('heading', { level: 1 });
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('ReportsPage accessibility', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: () => Promise.resolve({
        totalEmissions: 200, averageDaily: 6.7, carbonSaved: 45, moneySaved: 30,
        streak: 7, level: 'Tree', badgesCount: 3, points: 250,
        categoryBreakdown: [{ category: 'transport', emissions: 100 }],
        goals: [{ target: 200, achieved: true, date: '2025-01-15' }],
      }),
    } as any);
  });

  it('has proper heading', async () => {
    const { ReportsPage } = await import('../presentation/web/pages/ReportsPage');
    renderWithProviders(<ReportsPage />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Carbon Reports & Impact Card');
  });

  it('has no accessibility violations', async () => {
    const { ReportsPage } = await import('../presentation/web/pages/ReportsPage');
    const { container } = renderWithProviders(<ReportsPage />);
    await screen.findByRole('heading', { level: 1 });
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('Tracker page accessibility', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ activities: [], total: 0 }) } as any);
  });

  it('has proper heading', async () => {
    const { Tracker } = await import('../presentation/web/pages/Tracker');
    renderWithProviders(<Tracker />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Activity Tracker');
  });

  it('has log form region', async () => {
    const { Tracker } = await import('../presentation/web/pages/Tracker');
    renderWithProviders(<Tracker />);
    const region = await screen.findByLabelText('Log activity form');
    expect(region).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { Tracker } = await import('../presentation/web/pages/Tracker');
    const { container } = renderWithProviders(<Tracker />);
    await screen.findByRole('heading', { level: 1 });
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});
