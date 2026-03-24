const autocannon = require('autocannon')

const baseUrl = process.env.PERF_BASE_URL || 'http://localhost:3001'
const duration = Number(process.env.PERF_DURATION || 8)
const connections = Number(process.env.PERF_CONNECTIONS || 10)
const maxP99Ms = Number(process.env.PERF_MAX_P99_MS || 2000)
const minAverageRps = Number(process.env.PERF_MIN_AVG_RPS || 20)
const bookingRequests = Number(process.env.PERF_BOOKING_REQUESTS || 12)
const bookingConcurrency = Number(process.env.PERF_BOOKING_CONCURRENCY || Math.min(connections, 4))
const bookingMaxP95Ms = Number(process.env.PERF_BOOKING_MAX_P95_MS || 1000)
const bookingMinAverageRps = Number(process.env.PERF_BOOKING_MIN_AVG_RPS || 2)

function pad2(value) {
  return String(value).padStart(2, '0')
}

function futureDate(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + Number(offsetDays || 0))
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function percentile(values, point) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((point / 100) * sorted.length) - 1))
  return sorted[index]
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const message = payload?.message || payload?.error || String(payload || `Request failed (${response.status})`)
    const error = new Error(message)
    error.status = response.status
    error.data = payload
    throw error
  }

  return payload
}

function runAutocannonScenario(name, path, { headers } = {}) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: `${baseUrl}${path}`,
      method: 'GET',
      duration,
      connections,
      headers: {
        Accept: 'application/json',
        ...(headers || {}),
      },
    })

    instance.on('done', (result) => {
      const summary = {
        name,
        path,
        avgRps: Math.round(result.requests?.average ?? 0),
        p99: result.latency?.p99 ?? 0,
        errors: result.errors ?? 0,
        timeouts: result.timeouts ?? 0,
        non2xx: result.non2xx ?? result['non2xx'] ?? 0,
      }

      console.log(`\n${name}`)
      console.log(`- Path: ${path}`)
      console.log(`- Avg req/sec: ${summary.avgRps}`)
      console.log(`- P99 latency: ${summary.p99} ms`)
      console.log(`- Errors: ${summary.errors}, Timeouts: ${summary.timeouts}, Non-2xx: ${summary.non2xx}`)

      resolve(summary)
    })
  })
}

function buildBookingPayload(index, facilityIds) {
  return {
    facilityId: facilityIds[index % facilityIds.length],
    date: futureDate(500 + index),
    start: '10:00',
    end: '11:00',
    reason: `Perf smoke booking ${index + 1}`,
  }
}

async function runBookingCreateScenario({ token, facilityIds }) {
  const latencies = []
  const failures = []
  let completed = 0
  let nextIndex = 0
  const startMs = Date.now()

  async function worker() {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= bookingRequests) return

      const payload = buildBookingPayload(current, facilityIds)
      const requestStart = Date.now()

      try {
        const response = await fetchJson('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })

        if (!response?.id) {
          throw new Error('Booking response missing id')
        }
      } catch (error) {
        failures.push({ index: current, message: error?.message || String(error) })
      } finally {
        latencies.push(Date.now() - requestStart)
        completed += 1
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, bookingConcurrency) }, () => worker()))

  const elapsedSeconds = Math.max((Date.now() - startMs) / 1000, 0.001)
  const summary = {
    name: 'Booking creation burst',
    requests: completed,
    avgRps: Math.round(completed / elapsedSeconds),
    p95: percentile(latencies, 95),
    failures,
  }

  console.log(`\n${summary.name}`)
  console.log(`- Requests: ${summary.requests}`)
  console.log(`- Avg req/sec: ${summary.avgRps}`)
  console.log(`- P95 latency: ${summary.p95} ms`)
  console.log(`- Failures: ${summary.failures.length}`)
  if (summary.failures.length) {
    const sample = summary.failures.slice(0, 3).map((entry) => `${entry.index + 1}: ${entry.message}`).join(' | ')
    console.log(`- Failure samples: ${sample}`)
  }

  return summary
}

async function main() {
  console.log(`Running ${duration}s smoke test against ${baseUrl}`)
  console.log(`- Read connections: ${connections}`)
  console.log(`- Booking requests: ${bookingRequests}`)
  console.log(`- Booking concurrency: ${bookingConcurrency}`)

  const facilitiesPayload = await fetchJson('/api/facilities?page=1&pageSize=20')
  const facilityIds = (facilitiesPayload?.items || []).map((item) => item.id).filter(Boolean)
  if (facilityIds.length === 0) {
    throw new Error('No facilities available for perf smoke test')
  }

  const date = futureDate(400)
  const debugLogin = await fetchJson('/__debug/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'perf.runner@smu.edu.sg', role: 'student' }),
  })
  const token = debugLogin?.token
  if (!token) {
    throw new Error('Debug login did not return a token for perf smoke test')
  }

  const readScenarios = [
    await runAutocannonScenario('Facility search', '/api/facilities?page=1&pageSize=20'),
    await runAutocannonScenario('Availability lookup', `/api/facilities/${encodeURIComponent(facilityIds[0])}/availability?date=${date}`),
    await runAutocannonScenario('Bookings list', '/api/bookings', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]

  const bookingScenario = await runBookingCreateScenario({ token, facilityIds })

  const readFailures = readScenarios.filter((scenario) => {
    return scenario.errors > 0 || scenario.timeouts > 0 || scenario.non2xx > 0 || scenario.p99 > maxP99Ms || scenario.avgRps < minAverageRps
  })

  const bookingFailed = bookingScenario.failures.length > 0 || bookingScenario.p95 > bookingMaxP95Ms || bookingScenario.avgRps < bookingMinAverageRps

  console.log('\nPerf smoke thresholds')
  console.log(`- Read max allowed P99 latency: ${maxP99Ms} ms`)
  console.log(`- Read min required avg req/sec: ${minAverageRps}`)
  console.log(`- Booking max allowed P95 latency: ${bookingMaxP95Ms} ms`)
  console.log(`- Booking min required avg req/sec: ${bookingMinAverageRps}`)

  if (readFailures.length || bookingFailed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('\nPerf smoke failed to run:', error?.message || error)
  process.exitCode = 1
})
