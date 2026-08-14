import { Component, type ErrorInfo, type ReactNode } from "react";

type TabErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string | number | null;
};

type TabErrorBoundaryState = {
  error: Error | null;
};

export class TabErrorBoundary extends Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  state: TabErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: TabErrorBoundaryProps): void {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Tab render error:", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="tab-placeholder tab-placeholder--error">
          <p>Не удалось отобразить вкладку.</p>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={this.handleRetry}>
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
