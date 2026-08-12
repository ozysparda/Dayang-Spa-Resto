import { Component } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary that catches JavaScript errors anywhere in the child
 * component tree and displays a graceful fallback instead of crashing
 * the entire application.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Phase 17: Never expose stack traces to users - log to console only
    console.error('ErrorBoundary caught an error:', error.message);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Phase 17: Never expose error details or stack traces to users
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                Oops! Something went wrong
              </h2>
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </p>
              <button
                onClick={this.handleReload}
                className="btn-primary w-full"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper that allows the ErrorBoundary fallback to use
 * react-router's navigate for a soft retry.
 */
export function ErrorBoundaryWithRetry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                Something Went Wrong
              </h2>
              <p className="text-gray-600 mb-6">
                An unexpected error occurred. This usually happens when
                navigation happens too quickly. Please try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary w-full"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
