import http from 'http';

http.get('http://localhost:3000', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk.slice(0, 100)}...`);
  });
}).on('error', (e) => {
  console.error(`Error: ${e.message}`);
});
