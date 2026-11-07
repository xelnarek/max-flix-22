import { createServer } from 'node:http';
import { attachPvpWebSocketServer } from './pvpServer.ts';

const rawPort = Number(process.env.PVP_PORT || process.env.PORT || 8080);
const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 8080;

const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && (request.url === '/healthz' || request.url === '/health')) {
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify({ ok: true, service: 'paleciaki-pvp', websocketPath: '/pvp-ws' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

const websocketServer = attachPvpWebSocketServer(httpServer);

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`[PVP] WebSocket server listening on 0.0.0.0:${port}/pvp-ws`);
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[PVP] Received ${signal}; closing active matches.`);

  for (const client of websocketServer.clients) {
    client.close(1001, 'Server shutdown');
  }

  const forceExit = setTimeout(() => {
    for (const client of websocketServer.clients) client.terminate();
    process.exit(1);
  }, 5000);
  forceExit.unref();

  websocketServer.close(() => {
    httpServer.close(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
