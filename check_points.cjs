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

async function check() {
    try {
        console.log("Consultando Puntos de Venta habilitados en AFIP...");
        // Intentar con executeRequest directamente para el método oficial de AFIP
        const response = await afip.ElectronicBilling.executeRequest('FEParamGetPtosVenta');
        
        console.log("RESPUESTA DE AFIP:");
        const points = response.ResultGet && response.ResultGet.PtoVenta;
        if (points) {
            console.table(points);
        } else {
            console.log("No se encontraron puntos de venta habilitados.");
            console.log("Respuesta completa:", JSON.stringify(response, null, 2));
        }
    } catch (error) {
        console.error("Error al consultar AFIP:", error.message);
    }
}

check();
