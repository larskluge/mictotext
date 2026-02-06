import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkServer } from '../src/server-check.js';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, url: `http://localhost:${port}` });
    });
  });
}

describe('checkServer', () => {
  const servers = [];
  after(() => {
    for (const s of servers) s.close();
  });

  it('resolves when server returns healthy response', async () => {
    const { server, url } = await startServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    servers.push(server);
    await checkServer(url);
  });

  it('rejects when server is not running', async () => {
    await assert.rejects(
      () => checkServer('http://localhost:19999'),
      (err) => {
        assert.match(err.message, /not running|ECONNREFUSED|fetch failed/i);
        return true;
      }
    );
  });

  it('rejects when server returns unhealthy status', async () => {
    const { server, url } = await startServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error' }));
    });
    servers.push(server);
    await assert.rejects(
      () => checkServer(url),
      (err) => {
        assert.match(err.message, /not healthy|unhealthy|status/i);
        return true;
      }
    );
  });

  it('rejects when server returns non-200', async () => {
    const { server, url } = await startServer((req, res) => {
      res.writeHead(503);
      res.end();
    });
    servers.push(server);
    await assert.rejects(
      () => checkServer(url),
      (err) => {
        assert.match(err.message, /503|not healthy|unhealthy/i);
        return true;
      }
    );
  });
});
