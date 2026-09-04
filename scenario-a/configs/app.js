const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3000;
let hung = false;

const server = http.createServer((req, res) => {
  if (hung) return; // never respond again, socket just stays open

  if (req.url === '/healthz') {
    res.writeHead(200);
    res.end('OK');
  } else if (req.url === '/slow') {
    setTimeout(() => {
      res.writeHead(200);
      res.end('finally');
    }, 45000);
  } else if (req.url === '/crash') {
    res.writeHead(200);
    res.end('bye');
    setTimeout(() => process.exit(1), 100);
  } else if (req.url === '/hang') {
    res.writeHead(200);
    res.end('now hanging');
    hung = true;
  } else {
    res.writeHead(200);
    res.end(`ashik-myapp running on port ${PORT}, host ${os.hostname()}\n`);
  }
});

server.listen(PORT, () => console.log(`listening on ${PORT}`));
