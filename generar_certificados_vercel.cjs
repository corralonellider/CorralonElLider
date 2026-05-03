const fs = require('fs');
const path = require('path');

const cuit = '30716493365'; // Cambia esto si tu CUIT es distinto
const certPath = path.join(__dirname, 'arca', `cert-${cuit}.crt`);
const keyPath = path.join(__dirname, 'arca', `key-${cuit}.key`);

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const cert = fs.readFileSync(certPath).toString('base64');
  const key = fs.readFileSync(keyPath).toString('base64');
  
  console.log('\n--- COPIA ESTOS VALORES EN VERCEL ---\n');
  console.log('1. Variable: AFIP_CERT');
  console.log('Valor:\n' + cert + '\n');
  
  console.log('2. Variable: AFIP_KEY');
  console.log('Valor:\n' + key + '\n');
  
  console.log('-------------------------------------\n');
} else {
  console.log('No se encontraron los certificados en la carpeta arca/');
}
