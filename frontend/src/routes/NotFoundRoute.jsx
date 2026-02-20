import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Alert from '../components/Alert'

export default function NotFoundRoute() {
  return (
    <AppShell showSearch={false}>
      <div className="containerNarrow">
        <div className="card cardPad">
          <div className="stack">
            <h1 className="h1">Not found</h1>
            <Alert variant="danger" title="404">
              This page doesn’t exist.
            </Alert>
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
      </div>
    </AppShell>
  )
}
