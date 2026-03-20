const autocannon = require('autocannon')

const baseUrl = process.env.PERF_BASE_URL || 'http://localhost:3001'
const duration = Number(process.env.PERF_DURATION || 8)
const connections = Number(process.env.PERF_CONNECTIONS || 10)

const instance = autocannon({
  url: `${baseUrl}/api/facilities?page=1&pageSize=20`,
  method: 'GET',
  duration,
  connections,
  headers: {
    Accept: 'application/json',
  },
})

autocannon.track(instance, { renderProgressBar: true })

instance.on('done', (result) => {
  const p99 = result.latency?.p99 ?? 0
  const rps = Math.round(result.requests?.average ?? 0)
  const errors = result.errors ?? 0
  const timeouts = result.timeouts ?? 0

  console.log('\nPerf smoke summary')
  console.log(`- URL: ${baseUrl}/api/facilities?page=1&pageSize=20`)
  console.log(`- Duration: ${duration}s`) 
  console.log(`- Connections: ${connections}`)
  console.log(`- Avg req/sec: ${rps}`)
  console.log(`- P99 latency: ${p99} ms`)
  console.log(`- Errors: ${errors}, Timeouts: ${timeouts}`)

  // Fail smoke test if server is clearly unhealthy under light load.
  if (errors > 0 || timeouts > 0 || p99 > 2000) {
    process.exitCode = 1
  }
})
