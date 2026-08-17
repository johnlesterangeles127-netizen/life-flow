const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// ---- Load .env (if present) into process.env ----
// Keeps secrets like GROQ_API_KEY out of source code. Create a file named
// ".env" next to this one containing:
//   GROQ_API_KEY=gsk_xxx
// .env should NEVER be committed to git — see .gitignore.
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, 'utf8');
  contents.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Don't override a value already set in the real shell environment
    if (!(key in process.env)) process.env[key] = value;
  });
}
loadEnvFile();

// You can also set this directly in your shell instead of using .env, e.g.:
//   GROQ_API_KEY=gsk_xxx node server.js

const GROQ_API_KEY = process.env.GROQ_API_KEY;

function proxyToGroq(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    if (!GROQ_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server is missing GROQ_API_KEY env var.' }));
      return;
    }
    const groqReq = https.request(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        }
      },
      groqRes => {
        let data = '';
        groqRes.on('data', chunk => { data += chunk; });
        groqRes.on('end', () => {
          res.writeHead(groqRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      }
    );
    groqReq.on('error', err => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Could not reach Groq: ' + err.message }));
    });
    groqReq.write(body);
    groqReq.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/chat' && req.method === 'POST') {
    proxyToGroq(req, res);
    return;
  }

  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const extname = path.extname(filePath);

  let contentType = 'text/html';
  if (extname === '.js') contentType = 'application/javascript';
  if (extname === '.css') contentType = 'text/css';
  if (extname === '.json') contentType = 'application/json';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data, 'utf-8');
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});