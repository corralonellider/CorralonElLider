import express from 'express';
import cors from 'cors';
import Afip from '@afipsdk/afip.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("-----------------------------------------");
console.log("AFIP TOKEN LOADED:", process.env.AFIP_TOKEN ? "YES (Starts with " + process.env.AFIP_TOKEN.substring(0, 5) + "...)" : "NO");
console.log("-----------------------------------------");

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint to generate AFIP electronic invoice
app.post('/api/afip/invoice', async (req, res) => {
  try {
    const { 
      cuit_emisor,
      importe_total,
      concepto = 1, // 1 = Productos, 2 = Servicios, 3 = Productos y Servicios
      tipo_doc = 99, // 99 = Consumidor Final, 80 = CUIT
      nro_doc = 0,
      tipo_comprobante = 6, // 6 = Factura B
      punto_venta = parseInt(process.env.AFIP_PUNTO_VENTA) || 1 
    } = req.body;

    const cleanCuit = String(cuit_emisor).replace(/[^0-9]/g, '');

    if (!cleanCuit) {
      return res.status(400).json({ success: false, error: 'cuit_emisor inválido' });
    }

    // Leer el contenido de los certificados (Requerido para Afip SDK v1.0+)
    const certPath = path.join(__dirname, '..', 'arca', `cert-${cleanCuit}.crt`);
    const keyPath = path.join(__dirname, '..', 'arca', `key-${cleanCuit}.key`);

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      return res.status(404).json({ 
        success: false, 
        error: `No se encontraron certificados para el CUIT ${cleanCuit} en la carpeta /arca/` 
      });
    }

    const cert = fs.readFileSync(certPath, { encoding: 'utf8' });
    const key = fs.readFileSync(keyPath, { encoding: 'utf8' });

    // Initialize AFIP SDK dynamically for this CUIT
    const afip = new Afip({
      CUIT: parseInt(cleanCuit),
      cert: cert,
      key: key,
      access_token: process.env.AFIP_TOKEN || '',
      production: true // Producción
    });

    const f = new Date();
    // AFIP Date format: YYYYMMDD
    const dateStr = `${f.getFullYear()}${('0' + (f.getMonth() + 1)).slice(-2)}${('0' + f.getDate()).slice(-2)}`;

    // Get the last voucher number to issue the next one
    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(punto_venta, tipo_comprobante);
    const cbte_nro = lastVoucher + 1;

    const total = parseFloat(importe_total);
    const neto = parseFloat((total / 1.21).toFixed(2));
    const iva_cuota = parseFloat((total - neto).toFixed(2));

    const voucherData = {
      'CantReg': 1, // Cantidad de comprobantes a registrar
      'PtoVta': punto_venta,
      'CbteTipo': tipo_comprobante, 
      'Concepto': concepto,
      'DocTipo': tipo_doc,
      'DocNro': nro_doc,
      'CbteDesde': cbte_nro,
      'CbteHasta': cbte_nro,
      'CbteFch': dateStr,
      'ImpTotal': total,
      'ImpTotConc': 0,
      'ImpNeto': neto, 
      'ImpOpEx': 0,
      'ImpTrib': 0,
      'ImpIVA': iva_cuota,
      'MonId': 'PES',
      'MonCotiz': 1,
      'Iva': [
        {
          'Id': 5, // 21%
          'BaseImp': neto,
          'Importe': iva_cuota
        }
      ]
    };

    // Remove null values since AFIP SDK gets picky
    Object.keys(voucherData).forEach(key => voucherData[key] === null && delete voucherData[key]);

    console.log("DATOS ENVIADOS A AFIP:", JSON.stringify(voucherData, null, 2));

    // Create the voucher
    console.log("SOLICITANDO CAE A AFIP...");
    const response = await afip.ElectronicBilling.createVoucher(voucherData);
    console.log("RESPUESTA AFIP EXITOSA. CAE:", response.CAE);

    return res.json({
      success: true,
      cae: response.CAE,
      vto_cae: response.CAEFchVto, // Format YYYYMMDD
      pto_vta: punto_venta,
      cbte_nro: cbte_nro,
      response
    });

  } catch (error) {
    console.error('Error al generar comprobante AFIP:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error desconocido al contactar AFIP',
      details: error.response ? error.response.data : null
    });
  }
});

// Endpoint to generate AFIP Credit Note (Nota de Crédito)
app.post('/api/afip/credit-note', async (req, res) => {
  try {
    const { 
      cuit_emisor,
      importe_total,
      tipo_doc,
      nro_doc,
      original_tipo_comprobante,
      original_punto_venta,
      original_cbte_nro,
      punto_venta = original_punto_venta
    } = req.body;

    const cleanCuit = String(cuit_emisor).replace(/[^0-9]/g, '');

    if (!cleanCuit) {
      return res.status(400).json({ success: false, error: 'cuit_emisor inválido' });
    }

    // Determine Credit Note type based on original voucher
    // 1 (Factura A) -> 3 (Nota de Crédito A)
    // 6 (Factura B) -> 8 (Nota de Crédito B)
    // 11 (Factura C) -> 13 (Nota de Crédito C)
    let tipo_nc;
    if (original_tipo_comprobante === 1) tipo_nc = 3;
    else if (original_tipo_comprobante === 6) tipo_nc = 8;
    else if (original_tipo_comprobante === 11) tipo_nc = 13;
    else {
      return res.status(400).json({ success: false, error: 'Tipo de comprobante original no soportado para Nota de Crédito' });
    }

    const certPath = path.join(__dirname, '..', 'arca', `cert-${cleanCuit}.crt`);
    const keyPath = path.join(__dirname, '..', 'arca', `key-${cleanCuit}.key`);

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      return res.status(404).json({ success: false, error: 'No se encontraron certificados para este CUIT' });
    }

    const cert = fs.readFileSync(certPath, { encoding: 'utf8' });
    const key = fs.readFileSync(keyPath, { encoding: 'utf8' });

    const afip = new Afip({
      CUIT: parseInt(cleanCuit),
      cert: cert,
      key: key,
      access_token: process.env.AFIP_TOKEN || '',
      production: true
    });

    const f = new Date();
    const dateStr = `${f.getFullYear()}${('0' + (f.getMonth() + 1)).slice(-2)}${('0' + f.getDate()).slice(-2)}`;

    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(punto_venta, tipo_nc);
    const cbte_nro = lastVoucher + 1;

    const total = parseFloat(importe_total);
    const neto = parseFloat((total / 1.21).toFixed(2));
    const iva_cuota = parseFloat((total - neto).toFixed(2));

    const voucherData = {
      'CantReg': 1,
      'PtoVta': punto_venta,
      'CbteTipo': tipo_nc,
      'Concepto': 1, // Productos
      'DocTipo': tipo_doc,
      'DocNro': nro_doc,
      'CbteDesde': cbte_nro,
      'CbteHasta': cbte_nro,
      'CbteFch': dateStr,
      'ImpTotal': total,
      'ImpTotConc': 0,
      'ImpNeto': neto, 
      'ImpOpEx': 0,
      'ImpTrib': 0,
      'ImpIVA': iva_cuota,
      'MonId': 'PES',
      'MonCotiz': 1,
      'Iva': [
        {
          'Id': 5, // 21%
          'BaseImp': neto,
          'Importe': iva_cuota
        }
      ],
      'CbtesAsoc': [
        {
          'Tipo': original_tipo_comprobante,
          'PtoVta': original_punto_venta,
          'Nro': original_cbte_nro
        }
      ]
    };

    console.log("GENERANDO NOTA DE CRÉDITO:", JSON.stringify(voucherData, null, 2));

    console.log("SOLICITANDO CAE (NC) A AFIP...");
    const response = await afip.ElectronicBilling.createVoucher(voucherData);
    console.log("RESPUESTA AFIP EXITOSA (NC). CAE:", response.CAE);

    return res.json({
      success: true,
      cae: response.CAE,
      vto_cae: response.CAEFchVto,
      pto_vta: punto_venta,
      cbte_nro: cbte_nro,
      tipo_nc,
      response
    });

  } catch (error) {
    console.error('Error al generar Nota de Crédito:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al contactar AFIP para Nota de Crédito'
    });
  }
});

app.listen(PORT, () => {
  console.log(`AFIP Intermediary Server running on http://localhost:${PORT}`);
});
