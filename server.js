const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const itemsFile = path.join(dataDir, 'items.json');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function ensureItemsFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(itemsFile)) {
    const starterItems = [
      {
        type: 'text',
        title: 'Welcome to Northline Studio',
        body: 'Use the buttons above to collect notes, images, links, sketches, and other studio materials.'
      }
    ];
    fs.writeFileSync(itemsFile, JSON.stringify(starterItems, null, 2));
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        request.destroy();
        reject(new Error('Request body is too large'));
      }
    });

    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function serveFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
  const safePath = path.normalize(requestPath);
  const filePath = path.join(rootDir, safePath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(rootDir) || safePath.startsWith('..')) {
    send(response, 403, 'Forbidden');
    return;
  }

  fs.readFile(resolvedPath, (error, data) => {
    if (error) {
      send(response, 404, 'Not found');
      return;
    }

    const contentType = contentTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream';
    send(response, 200, data, contentType);
  });
}

ensureItemsFile();

const server = http.createServer(async (request, response) => {
  if (request.url === '/api/items' && request.method === 'GET') {
    fs.readFile(itemsFile, 'utf8', (error, data) => {
      if (error) {
        send(response, 500, 'Could not read shared board');
        return;
      }

      send(response, 200, data, 'application/json; charset=utf-8');
    });
    return;
  }

  if (request.url === '/api/items' && request.method === 'PUT') {
    try {
      const body = await readRequestBody(request);
      const items = JSON.parse(body);

      if (!Array.isArray(items)) {
        send(response, 400, 'Shared board must be an array');
        return;
      }

      fs.writeFile(itemsFile, JSON.stringify(items, null, 2), (error) => {
        if (error) {
          send(response, 500, 'Could not save shared board');
          return;
        }

        send(response, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
      });
    } catch {
      send(response, 400, 'Invalid shared board data');
    }
    return;
  }

  if (request.method !== 'GET') {
    send(response, 405, 'Method not allowed');
    return;
  }

  serveFile(request, response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Northline Studio shared board is running at http://localhost:${port}`);
});
