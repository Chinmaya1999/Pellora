import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="center" style={{ textAlign: "center", padding: 24 }}>
        <div>
          <h2>Something went wrong</h2>
          <p className="muted">Please reload the page. If it keeps happening, contact support.</p>
          <button className="btn" onClick={() => location.assign("/")}>Back to home</button>
        </div>
      </div>
    );
  }
}
