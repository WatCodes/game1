import { Component, type ReactNode } from 'react';

// A GPU/driver failure inside the 3D scene must degrade to the 2D diorama,
// never take down the app. React only catches render/lifecycle errors via a
// class error boundary — hence this small class component.
export class SceneErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null; // parent switches to 2D on onError
    return this.props.children;
  }
}
