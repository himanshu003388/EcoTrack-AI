import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ErrorBoundary } from '../presentation/web/components/ErrorBoundary';
import { Skeleton, CardSkeleton, ChartSkeleton, TableSkeleton } from '../presentation/web/components/Skeleton';
import { ToastProvider, useToast } from '../presentation/web/components/Toast';

expect.extend(toHaveNoViolations);


function TestToastTrigger() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast('success', 'Test notification')} aria-label="Trigger toast">
      Show toast
    </button>
  );
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { container } = render(
      <ErrorBoundary>
        <p>Test child</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test child')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Something went wrong');
  });

  it('renders error UI when error occurs', () => {
    const ThrowError = () => { throw new Error('Test crash'); };
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Reload page')).toBeInTheDocument();
  });

  it('has no accessibility violations in error state', async () => {
    const ThrowError = () => { throw new Error('A11y test'); };
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Skeleton components', () => {
  it('Skeleton renders with aria-hidden', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('CardSkeleton is aria-hidden', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('ChartSkeleton is aria-hidden', () => {
    const { container } = render(<ChartSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('TableSkeleton is aria-hidden', () => {
    const { container } = render(<TableSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('all skeleton components have no a11y violations', async () => {
    const { container } = render(
      <div>
        <Skeleton className="h-4 w-24" />
        <CardSkeleton />
        <ChartSkeleton />
        <TableSkeleton />
      </div>
    );
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});

describe('Toast system', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <p>Toast child</p>
      </ToastProvider>
    );
    expect(screen.getByText('Toast child')).toBeInTheDocument();
  });

  it('shows toast notification when triggered', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestToastTrigger />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: /trigger toast/i }));
    expect(screen.getByText('Test notification')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const container = screen.getByLabelText('Notifications');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  it('dismiss button has accessible label', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestToastTrigger />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: /trigger toast/i }));
    const dismissBtn = screen.getByLabelText('Dismiss notification');
    expect(dismissBtn).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <ToastProvider>
        <TestToastTrigger />
      </ToastProvider>
    );
    const results = await axe(container);
    await expect(results).toHaveNoViolations();
  });
});
