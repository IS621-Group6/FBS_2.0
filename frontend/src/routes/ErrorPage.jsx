import { Link, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'

function titleFor(code) {
  switch (code) {
    case 400:
      return 'Bad request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Page not found'
    case 409:
      return 'Conflict'
    case 500:
      return 'Server error'
    default:
      return code >= 500 ? 'Server error' : 'Something went wrong'
  }
}

export default function ErrorPage() {
  const [sp] = useSearchParams()

  const rawCode = sp.get('code')
  const code = Number(rawCode)
  const safeCode = Number.isFinite(code) && code > 0 ? code : 500

  const message = sp.get('message') || ''
  const title = titleFor(safeCode)

  return (
    <AppShell showSearch={false}>
      <div className="containerNarrow">
        <div className="stack">
          <div>
            <h1 className="h1">{title}</h1>
            <div className="muted2">Error code: {safeCode}</div>
          </div>

          <div className="card cardPad">
            <div className="stack">
              <div className="h2">What you can do</div>
              <div className="muted">
                {message ? message : 'Try going back, or return to search and try again.'}
              </div>

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Link className="btn" to="/search">
                  Back to search
                </Link>
                <Link className="btn btnPrimary" to="/">
                  Home
                </Link>
              </div>
            </div>
          </div>

          <div className="muted2" style={{ fontSize: 12 }}>
            If this keeps happening, refresh the page.
          </div>
        </div>
      </div>
    </AppShell>
  )
}
