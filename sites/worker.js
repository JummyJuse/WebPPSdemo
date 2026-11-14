const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const limit = 6
const maxIdle = 45000

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function qrImage(url) {
  const qr = new QRCode(-1, correction.M)
  qr.addData(url)
  qr.make()
  const size = qr.getModuleCount()
  let path = ''
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col)) path += `M${col + 4},${row + 4}h1v1h-1z`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + 8} ${size + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${path}"/></svg>`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url
    if (request.method === 'GET') {
      if (pathname === '/' || /^\/join\/[A-Z2-9]{6}$/.test(pathname)) {
        return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
      if (pathname === '/lobby.js') return new Response(client, { headers: { 'Content-Type': 'text/javascript' } })
      const qr = pathname.match(/^\/api\/qr\/([A-Z2-9]{6})$/)
      if (qr) return new Response(qrImage(url.origin + '/join/' + qr[1]), { headers: { 'Content-Type': 'image/svg+xml' } })
    }
    if (request.method !== 'POST' || pathname !== '/api/lobby') return json({ error: 'Not found.' }, 404)
    let input
    try { input = await request.json() } catch { return json({ error: 'Invalid request.' }, 400) }
    const { action, code, token } = input ?? {}
    const now = Date.now()
    const cutoff = now - maxIdle
    const db = env.DB
    const sql = (query, ...args) => db.prepare(query).bind(...args)
    if (action === 'create') {
      await sql('DELETE FROM rooms WHERE seen < ?', cutoff).run()
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join('')
        const token = crypto.randomUUID()
        const result = await sql('INSERT OR IGNORE INTO rooms VALUES (?, ?, ?)', code, token, now).run()
        if (result.meta.changes) return json({ code, token, host: true, players: [] }, 201)
      }
      return json({ error: 'Could not allocate a room. Try again.' }, 503)
    }
    if (typeof code !== 'string' || !/^[A-Z2-9]{6}$/.test(code)) return json({ error: 'Enter a six-character room code.' }, 400)
    if (action === 'join') {
      const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ').slice(0, 24) : ''
      if (!name) return json({ error: 'Enter your name.' }, 400)
      const playerToken = crypto.randomUUID()
      const [, inserted] = await db.batch([
        sql('DELETE FROM players WHERE room = ? AND seen < ?', code, cutoff),
        sql(`INSERT INTO players (room, token, name, seen)
             SELECT code, ?, ?, ? FROM rooms WHERE code = ? AND seen >= ?
             AND (SELECT COUNT(*) FROM players WHERE room = ?) < ?`, playerToken, name, now, code, cutoff, code, limit)
      ])
      if (!inserted.meta.changes) {
        const room = await sql('SELECT code FROM rooms WHERE code = ? AND seen >= ?', code, cutoff).first()
        return room ? json({ error: 'This room is full (6/6).' }, 409) : json({ error: 'Room not found or closed.' }, 404)
      }
      return json({ code, token: playerToken, host: false }, 201)
    }
    if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/.test(token)) return json({ error: 'Invalid session.' }, 403)
    if (action === 'leave') {
      await db.batch([
        sql('DELETE FROM rooms WHERE code = ? AND host = ?', code, token),
        sql('DELETE FROM players WHERE room = ? AND token = ?', code, token)
      ])
      return json({ ok: true })
    }
    if (action !== 'sync') return json({ error: 'Unknown action.' }, 400)
    const [host, player, roster] = await db.batch([
      sql('UPDATE rooms SET seen = ? WHERE code = ? AND host = ? AND seen >= ?', now, code, token, cutoff),
      sql('UPDATE players SET seen = ? WHERE room = ? AND token = ? AND seen >= ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND seen >= ?)', now, code, token, cutoff, code, cutoff),
      sql('SELECT name FROM players WHERE room = ? AND seen >= ? ORDER BY rowid', code, cutoff)
    ])
    if (!host.meta.changes && !player.meta.changes) return json({ error: 'The room closed or your connection expired.' }, 404)
    return json({ code, players: roster.results })
  }
}
