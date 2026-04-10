import http from 'http';

const check = (url) => {
  http.get(url, (res) => {
    console.log(`URL: ${url}`);
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`CONTENT-TYPE: ${res.headers['content-type']}`);
    res.on('data', () => {}); // consume
  }).on('error', (e) => {
    console.error(`Error for ${url}: ${e.message}`);
  });
};

check('http://localhost:3000/');
check('http://localhost:3000/src/main.tsx');
check('http://localhost:3000/src/App.tsx');
