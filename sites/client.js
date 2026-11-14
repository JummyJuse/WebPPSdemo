const get = id => document.getElementById(id)
const invited = location.pathname.match(/^\/join\/([A-Z2-9]{6})$/)?.[1]
let session
let timer
let busy = false

function notice(message = '') {
  get('notice').textContent = message
}

function show(screen) {
  for (const id of ['home', 'join', 'lobby']) get(id).classList.toggle('hidden', id !== screen)
  notice()
}

async function call(input) {
  const response = await fetch('/api/lobby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(8000)
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status })
  return result
}

function render(players) {
  get('count').textContent = players.length + '/6'
  const roster = get('roster')
  const seats = Array.from({ length: 6 }, (_, index) => {
    const seat = document.createElement('div')
    seat.className = 'seat' + (players[index] ? '' : ' empty')
    const label = document.createElement('b')
    label.textContent = 'OPERATOR ' + (index + 1)
    const name = document.createElement('span')
    name.textContent = players[index]?.name ?? 'Awaiting player'
    seat.append(label, name)
    return seat
  })
  roster.replaceChildren(...seats)
  get('status').textContent = players.length === 6 ? 'Crew complete' : (6 - players.length) + ' open slots'
}

function reset(message) {
  clearTimeout(timer)
  session = undefined
  sessionStorage.removeItem('pps-session')
  history.replaceState(null, '', '/')
  show('home')
  notice(message)
}

async function sync() {
  const current = session
  if (!current) return
  try {
    const result = await call({ ...current, action: 'sync' })
    if (session !== current) return
    render(result.players)
    notice()
  } catch (error) {
    if (session !== current) return
    if (error.status === 404) return reset(error.message)
    notice('Connection interrupted. Reconnecting…')
  }
  if (session === current) timer = setTimeout(sync, 1500)
}

function openLobby(result) {
  session = { code: result.code, token: result.token, host: result.host }
  sessionStorage.setItem('pps-session', JSON.stringify(session))
  get('code').textContent = result.code
  get('role').textContent = result.host ? 'ROOM HOST' : 'CREW MEMBER'
  get('share').classList.toggle('hidden', !result.host)
  get('hint').textContent = result.host ? 'Invite up to six operators to your room.' : 'You joined the operator lobby.'
  get('leave').textContent = result.host ? 'Close room' : 'Leave room'
  if (result.host) {
    get('qr').src = '/api/qr/' + result.code
    get('link').value = location.origin + '/join/' + result.code
  }
  show('lobby')
  render(result.players ?? [])
  sync()
}

async function enter(input, button) {
  if (busy) return
  busy = true
  button.disabled = true
  try { openLobby(await call(input)) }
  catch (error) { notice(error.message || 'Could not connect. Try again.') }
  finally { busy = false; button.disabled = false }
}

get('create').onclick = event => enter({ action: 'create' }, event.currentTarget)
get('joinButton').onclick = () => show('join')
get('back').onclick = () => { history.replaceState(null, '', '/'); show('home') }
get('joinForm').onsubmit = event => {
  event.preventDefault()
  enter({ action: 'join', code: get('roomCode').value.trim().toUpperCase(), name: get('name').value }, event.submitter)
}
get('leave').onclick = async event => {
  const button = event.currentTarget
  button.disabled = true
  try { await call({ ...session, action: 'leave' }); reset() }
  catch { notice('Could not leave. Try again.') }
  finally { button.disabled = false }
}
get('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(get('link').value)
    get('copy').textContent = 'Copied'
    setTimeout(() => { get('copy').textContent = 'Copy' }, 1400)
  } catch { get('link').select(); notice('Copy the selected invitation link.') }
}
const saved = JSON.parse(sessionStorage.getItem('pps-session') || 'null')
if (saved && (!invited || invited === saved.code)) openLobby(saved)
else if (invited) { get('roomCode').value = invited; show('join') }
