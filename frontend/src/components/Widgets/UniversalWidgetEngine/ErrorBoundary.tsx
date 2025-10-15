/**
 * Error Boundary for Universal Widget Engine
 * Catches and displays errors that occur during widget rendering
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  widgetId: number;
  blueprintName: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Universal Widget Engine Error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="text-center space-y-3 max-w-sm">
            <div className="text-red-500 text-4xl">⚠️</div>
            <div className="text-lg font-medium text-red-600">Widget Error</div>
            <p className="text-sm text-gray-600">
              This widget encountered an error and could not be rendered.
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <div>Widget ID: {this.props.widgetId}</div>
              <div>Blueprint: {this.props.blueprintName}</div>
              {this.state.error && (
                <div className="mt-2 p-2 bg-red-50 rounded text-left">
                  <div className="font-mono text-xs text-red-800">{this.state.error.message}</div>
                </div>
              )}
            </div>
            <button
              onClick={() =>
                this.setState({ hasError: false, error: undefined, errorInfo: undefined })
              }
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
