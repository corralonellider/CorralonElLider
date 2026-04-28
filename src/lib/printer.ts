import { supabase } from './supabase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generateTicketHTML = (saleResult: any, isCreditNote: boolean = false) => {
    let qrImgHtml = '';
    const caeToUse = isCreditNote ? saleResult.afip_nc_cae : saleResult.afip_cae;
    const vtoCaeToUse = isCreditNote ? saleResult.afip_nc_vto_cae : saleResult.afip_vto_cae;
    const cbteNroToUse = isCreditNote ? saleResult.afip_nc_cbte_nro : saleResult.afip_cbte_nro;

    if (caeToUse) {
      let tipoCmp = 0;
      if (isCreditNote) {
         tipoCmp = saleResult.type === 'FACTURA_A' ? 3 : saleResult.type === 'FACTURA_B' ? 8 : saleResult.type === 'FACTURA_C' ? 13 : 0;
      } else {
         tipoCmp = saleResult.type === 'FACTURA_A' ? 1 : saleResult.type === 'FACTURA_B' ? 6 : saleResult.type === 'FACTURA_C' ? 11 : 0;
      }
      const docType = saleResult.customer_cuit ? 80 : 99;
      const docNro = saleResult.customer_cuit ? parseInt(saleResult.customer_cuit.replace(/[^0-9]/g, '')) : 0;

      const qrDataObj = {
        ver: 1,
        fecha: new Date(saleResult.created_at || Date.now()).toISOString().split('T')[0],
        cuit: 30716493365,
        ptoVta: saleResult.afip_pto_vta || 5,
        tipoCmp,
        nroCmp: cbteNroToUse || 0,
        importe: saleResult.total,
        moneda: "PES",
        ctz: 1.00,
        tipoDocRec: docType,
        nroDocRec: docNro,
        tipoCodAut: "E",
        codAut: parseInt(caeToUse)
      };
      
      const qrBase64 = btoa(JSON.stringify(qrDataObj));
      const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;
      qrImgHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}" alt="AFIP QR" style="width: 120px; height: 120px;" crossorigin="anonymous" />`;
    }

    const docLetter = saleResult.type?.includes('FACTURA_A') ? 'A' : saleResult.type?.includes('FACTURA_B') ? 'B' : saleResult.type?.includes('FACTURA_C') ? 'C' : 'X';
    const isAfipDoc = caeToUse ? true : false;
    
    let docName = 'REMITO NO VÁLIDO COMO FACTURA';
    if (isAfipDoc) {
        docName = isCreditNote ? `NOTA DE CRÉDITO ${docLetter}` : `FACTURA ${docLetter}`;
    }

    const cbteStr = cbteNroToUse ? String(cbteNroToUse).padStart(8, '0') : (saleResult.order_number || String(saleResult.id).slice(0,8));
    const ptoVtaView = String(saleResult.afip_pto_vta || 5).padStart(5, '0');

    const generateCopy = (copyLabel: string) => `
          <div class="ticket-container">
            <div style="text-align: center; font-size: 11px; font-weight: 900; margin-bottom: 10px; border-bottom: 1px solid black; padding-bottom: 2px;">
              DOCUMENTO ${copyLabel}
            </div>
            <div class="header-info">
              <div class="logo-letter">${docLetter}</div>
              <div class="doc-title">${docName}</div>
              <h2>Corralón El Líder</h2>
              <div class="company-details">
                Av Avellaneda 5768/70, Virreyes, San Fernando, Buenos Aires<br/>
                CUIT: 30-71649336-5<br/>
                Ing. Brutos: 30-71649336-5<br/>
                Inicio Act.: 01/01/2021<br/>
                IVA Responsable Inscripto
              </div>
            </div>

            <div class="customer-details">
              <strong>N° Comp:</strong> ${ptoVtaView}-${cbteStr}<br/>
              <strong>Fecha:</strong> ${new Date(saleResult.created_at || Date.now()).toLocaleDateString('es-AR')}<br/>
              <strong>Cliente:</strong> ${saleResult.customer_name || 'CONSUMIDOR FINAL'}<br/>
              ${saleResult.customer_cuit ? `<strong>CUIT/DNI:</strong> ${saleResult.customer_cuit}<br/>` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th width="15%">Cant</th>
                  <th width="55%">Descripción</th>
                  <th width="30%" style="text-align: right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${saleResult.items.map((i: any) => `
                  <tr>
                    <td>${i.quantity || i.qty}</td>
                    <td>${(i.product?.name || 'Varios').slice(0, 20)}</td>
                    <td style="text-align: right">$${( (i.quantity || i.qty) * (i.unit_price || i.price)).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-row">
              TOTAL: $${saleResult.total.toLocaleString()}
            </div>

            ${isAfipDoc ? `
            <div class="afip-footer">
              <div class="afip-logo">AFIP</div>
              <div style="font-size: 9px; margin-bottom: 10px;">Comprobante Electrónico Autorizado</div>
              <div class="cae-box">
                 CAE: ${caeToUse}<br/>
                 Vto CAE: ${vtoCaeToUse ? new Date(vtoCaeToUse).toLocaleDateString('es-AR') : ''}
              </div>
              <div class="qr-container">
                ${qrImgHtml}
              </div>
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 15px; font-size: 10px;">
              ¡Gracias por su compra!
            </div>
          </div>
    `;

    return `
      <html>
        <head>
          <title>Comprobante ${cbteStr} - El Líder</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; margin: 0; color: black; width: 100%; max-width: 80mm; font-size: 11px; }
            .ticket-container { padding: 5px; }
            .header-info { text-align: center; border-bottom: 2px dashed black; padding-bottom: 10px; margin-bottom: 5px; }
            .header-info h2 { margin: 2px 0; font-size: 16px; font-weight: 900; }
            .logo-letter { border: 2px solid black; font-size: 24px; font-weight: bold; width: 35px; height: 35px; margin: 0 auto; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; }
            .doc-title { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
            .company-details, .customer-details { font-size: 10px; margin-bottom: 5px; }
            table { width: 100%; font-size: 11px; margin: 5px 0; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid black; padding-bottom: 3px; font-size: 10px;}
            td { padding-top: 3px; vertical-align: top;}
            .total-row { font-size: 14px; font-weight: bold; text-align: right; border-top: 2px solid black; padding-top: 5px; margin-top: 5px; }
            .afip-footer { margin-top: 15px; border-top: 1px dashed black; padding-top: 10px; text-align: center; }
            .cae-box { text-align: left; font-size: 11px; margin-bottom: 10px; font-weight: bold; }
            .qr-container { text-align: center; margin: 5px 0; }
            .afip-logo { font-size: 16px; font-weight: 900; font-style: italic; margin-bottom: 2px; }
            @media print {
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          ${generateCopy('ORIGINAL')}
          
          <div class="page-break" style="border-bottom: 1px dashed black; margin: 30px 0;"></div>
          
          ${generateCopy('DUPLICADO')}
        </body>
      </html>
    `;
};

export const printTicket = (saleResult: any, isCreditNote: boolean = false) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("⚠️ Tu navegador bloqueó la ventana de impresión.");
      return;
    }

    const html = generateTicketHTML(saleResult, isCreditNote);
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
};

export const generateAndUploadTicketPDF = async (saleResult: any, isCreditNote: boolean = false): Promise<string> => {
    const html = generateTicketHTML(saleResult, isCreditNote);
    
    // Create temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '80mm'; // Match ticket width
    container.style.backgroundColor = '#ffffff';
    document.body.appendChild(container);

    // Wait for external images (QR) to load
    await new Promise(r => setTimeout(r, 1000));

    // Capture to canvas
    const canvas = await html2canvas(container, { 
      scale: 1.5, 
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);

    // Convert to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    const pdfWidth = 80; // 80mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    const pdfBlob = pdf.output('blob');

    // Upload to Supabase
    const cbteStr = saleResult.afip_cbte_nro ? String(saleResult.afip_cbte_nro).padStart(8, '0') : (saleResult.order_number || String(saleResult.id).slice(0,8));
    const fileName = `ticket_${cbteStr}_${Date.now()}.pdf`;

    const { error } = await supabase.storage.from('tickets').upload(fileName, pdfBlob, {
      contentType: 'application/pdf',
      upsert: false
    });

    if (error) {
      console.error('Upload PDF Error:', error);
      throw new Error('Error al subir el PDF a la nube: ' + error.message);
    }

    // Get public URL
    const { data } = supabase.storage.from('tickets').getPublicUrl(fileName);
    return data.publicUrl;
};
