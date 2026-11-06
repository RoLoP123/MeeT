// Random video chat: pairs strangers and relays WebRTC signaling + text chat.
// Video and audio go directly between the two browsers, not through this server.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
});
const wss = new WebSocketServer({ server });
let waiting = null;

const send = (c, o) => c && c.readyState === 1 && c.send(JSON.stringify(o));
const broadcastCount = () => wss.clients.forEach(c => send(c, { t: 'online', n: wss.clients.size }));

function unpair(c) {
  if (waiting === c) waiting = null;
  const p = c.peer;
  if (p) { p.peer = null; c.peer = null; send(p, { t: 'left' }); }
}

function find(c) {
  unpair(c);
  if (waiting && waiting !== c && waiting.readyState === 1) {
    const p = waiting; waiting = null;
    c.peer = p; p.peer = c;
    send(c, { t: 'matched', init: true });
    send(p, { t: 'matched', init: false });
  } else waiting = c;
}

wss.on('connection', ws => {
  broadcastCount();
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'find') find(ws);
    else if (m.t === 'signal' && ws.peer) send(ws.peer, { t: 'signal', data: m.data });
    else if (m.t === 'chat' && ws.peer) send(ws.peer, { t: 'chat', text: String(m.text).slice(0, 500) });
    else if (m.t === 'report') console.log('REPORT', new Date().toISOString());
  });
  ws.on('close', () => { unpair(ws); broadcastCount(); });
});

server.listen(process.env.PORT || 3000, () => console.log('Live chat running on port ' + (process.env.PORT || 3000)));
