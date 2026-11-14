import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'

const original = readFileSync('server.js', 'utf8')
const page = original.split('const page=`')[1].split('<script src="/socket.io/')[0]
  .replace('PPS | Power Plant Control Room', 'PPS — Power Plant Simulator')
  .replace('Operate Together.<br><em>Power the Plant.</em>', 'Power Plant <em>Simulator</em>')
  .replace('MULTIPLAYER / CONTROL ROOM', 'MULTIPLAYER LOBBY')
  .replace('Leave / Close Room', 'Leave room')
const client = readFileSync('sites/client.js', 'utf8')
const modules = readdirSync('sites/qr').filter(name => name.endsWith('.js')).map(name => {
  return JSON.stringify('./' + name.slice(0, -3)) + ': (module, exports, require) => {\n' +
    readFileSync('sites/qr/' + name, 'utf8') + '\n}'
})
const qr = `const qrModules = {${modules.join(',\n')}};
const qrCache = {};
function requireQr(name) {
  if (qrCache[name]) return qrCache[name].exports;
  const module = qrCache[name] = { exports: {} };
  qrModules[name](module, module.exports, requireQr);
  return module.exports;
}
const QRCode = requireQr('./index');
const correction = requireQr('./QRErrorCorrectLevel');\n`
mkdirSync('dist/server', { recursive: true })
mkdirSync('dist/.openai', { recursive: true })
copyFileSync('.openai/hosting.json', 'dist/.openai/hosting.json')
writeFileSync('dist/server/index.js',
  'const page = ' + JSON.stringify(page + '<script src="/lobby.js"></script></body></html>') + ';\n' +
  'const client = ' + JSON.stringify(client) + ';\n' + qr + readFileSync('sites/worker.js', 'utf8'))
