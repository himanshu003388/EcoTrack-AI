import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level React error boundary.
 *
 * @security CWE-209 — Generation of Error Message Containing Sensitive Information.
 * Raw error messages (which may contain stack traces, connection strings, or secrets)
 * are NEVER rendered into the DOM. Only a safe, generic message is shown to the user.
 * The actual error is logged to console (in development only) via componentDidCatch.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Only log error details to the console in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[EcoTrack ErrorBoundary]', error, info.componentStack);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-screen w-screen items-center justify-center bg-slate-50"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md text-center space-y-4 p-8">
            <h1 className="font-display text-2xl font-bold text-slate-900">Something went wrong</h1>
            {/* @security: Never render this.state.error.message — it may contain sensitive internals */}
            <p className="text-slate-600 text-sm">An unexpected error occurred. Please try reloading the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-forest-500 text-white rounded-xl font-semibold text-sm hover:bg-forest-600 transition-colors"
              aria-label="Reload the page to recover from the error"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
