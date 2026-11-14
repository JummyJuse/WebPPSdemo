import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import './build.mjs'
const { default: worker } = await import('../dist/server/index.js')

const sqlite = new DatabaseSync(':memory:')
sqlite.exec('PRAGMA foreign_keys = ON')
sqlite.exec(readFileSync('drizzle/0000_lobby.sql', 'utf8'))
const DB = {
  prepare(query) {
    const statement = sqlite.prepare(query)
    return {
      bind(...args) {
        return {
          first: () => statement.get(...args),
          run: () => statement.columns().length
            ? { results: statement.all(...args), meta: { changes: 0 } }
            : { meta: statement.run(...args) }
        }
      }
    }
  },
  batch(statements) {
    sqlite.exec('BEGIN')
    try {
      const results = statements.map(statement => statement.run())
      sqlite.exec('COMMIT')
      return results
    } catch (error) {
      sqlite.exec('ROLLBACK')
      throw error
    }
  }
}
const portArg = process.argv.indexOf('--port')
const port = Number(portArg === -1 ? process.env.PORT || 3000 : process.argv[portArg + 1])
createServer(async (req, res) => {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const origin = (req.headers['x-forwarded-proto'] || 'http') + '://' + (req.headers['x-forwarded-host'] || req.headers.host)
    const request = new Request(new URL(req.url, origin), {
      method: req.method,
      headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined
    })
    const response = await worker.fetch(request, { DB })
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(error)
    res.writeHead(500).end('Preview failed')
  }
}).listen(port, '0.0.0.0')
