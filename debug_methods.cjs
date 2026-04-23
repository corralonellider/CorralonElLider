const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const cuit = "30716493365";
const certPath = path.join(__dirname, 'arca', `cert-${cuit}.crt`);
const keyPath = path.join(__dirname, 'arca', `key-${cuit}.key`);

const cert = fs.readFileSync(certPath, { encoding: 'utf8' });
const key = fs.readFileSync(keyPath, { encoding: 'utf8' });

const afip = new Afip({
    CUIT: parseInt(cuit),
    cert: cert,
    key: key,
    access_token: process.env.AFIP_TOKEN,
    production: true
});

console.log("Métodos disponibles en ElectronicBilling:");
console.log(Object.keys(afip.ElectronicBilling));
