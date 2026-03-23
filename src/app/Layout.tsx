import { Outlet, Link } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-app-bg font-body">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-app-accent focus:text-white focus:font-semibold focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>
      <header
        className="bg-white border-b border-app-border"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-app-accent rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm font-display">C</span>
            </div>
            <span className="font-display font-bold text-app-text text-lg tracking-tight">
              Company Intelligence
            </span>
          </Link>
        </div>
      </header>
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
