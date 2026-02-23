import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });
    
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  copyError = (): void => {
    if (this.state.error) {
      const errorText = `${this.state.error.message}\n\n${this.state.error.stack || ''}`;
      navigator.clipboard.writeText(errorText);
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-lg w-full bg-card border border-border rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Something went wrong</h1>
                <p className="text-muted-foreground text-sm">
                  An unexpected error occurred
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">
                  {this.state.error.message}
                </p>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show details
                    </>
                  )}
                </Button>

                {this.state.showDetails && this.state.errorInfo && (
                  <pre className="mt-3 p-3 bg-muted rounded-md text-xs overflow-auto max-h-48">
                    <code>{this.state.errorInfo.componentStack || this.state.error.stack}</code>
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={this.reset} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                <Home className="w-4 h-4 mr-2" />
                Go home
              </Button>
              <Button variant="ghost" size="icon" onClick={this.copyError} title="Copy error">
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground text-center">
              If this problem persists, please{' '}
              <a
                href="https://github.com/codex-linux/codex-linux/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                report an issue
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AsyncErrorBoundaryState {
  hasError: boolean;
}

export class AsyncErrorBoundary extends Component<
  AsyncErrorBoundaryProps,
  AsyncErrorBoundaryState
> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AsyncErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 border border-destructive rounded-md bg-destructive/10">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span>Failed to load content</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

interface PanelErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-destructive/30 rounded-md bg-destructive/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">
                {this.props.title || 'Panel Error'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                this.setState({ hasError: false, error: null, errorInfo: null })
              }
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message || 'An error occurred in this panel'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
