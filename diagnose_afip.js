import Afip from '@afipsdk/afip.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const afip = new Afip({
    CUIT: 20921169575,
    cert: path.join(__dirname, 'arca', 'cert-20921169575.crt'),
    key: path.join(__dirname, 'arca', 'key-20921169575.key'),
    production: true
});

console.log("Checking token...");
afip.ElectronicBilling.getLastVoucher(1, 6)
  .then(res => console.log("Success:", res))
  .catch(err => {
    console.log(err);
  });
