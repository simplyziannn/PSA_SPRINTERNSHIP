import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, details) {
    console.error('PSA control station render failed', error, details)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="app-crash-state"><section><span>CONTROL STATION ERROR</span><h1>The interface hit an unexpected error</h1><p>{this.state.error.message || 'An unknown rendering error occurred.'}</p><button onClick={() => window.location.reload()}>Reload control station</button><small>If this happened after a code update, stop the existing dev processes and restart <code>npm run dev</code>.</small></section></main>
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
