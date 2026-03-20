import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="text-app-red font-bold text-lg mb-2">Something went wrong</p>
          <p className="text-app-text-muted text-sm mb-4">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-app-accent text-white font-semibold text-sm"
          >
            Try again
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
