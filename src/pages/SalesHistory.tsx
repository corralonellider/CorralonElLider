
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Input } from '../components/ui';
import { History, Search, FileText, Calendar, User, Printer, Eye, MessageCircle, FileX } from 'lucide-react';
import { printTicket } from '../lib/printer';
import { cn } from '../components/ui';

export const SalesHistory = ({ isTab }: { isTab?: boolean }) => {
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                customer:customers(name, cuit),
                items:sale_items(
                    *,
                    product:products(name)
                )
            `)
            .order('created_at', { ascending: false });

        if (data) setSales(data);
        setLoading(false);
    };

    const handlePrint = (sale: any, isCreditNote: boolean = false) => {
        const saleData = {
            ...sale,
            type: sale.document_type,
            customer_name: sale.customer?.name || 'CONSUMIDOR FINAL',
            customer_cuit: sale.customer?.cuit,
            items: sale.items
        };
        printTicket(saleData, isCreditNote);
    };

    const handleCreditNote = async (sale: any) => {
        const confirmNC = window.confirm(`¿Estás seguro de que deseas generar una NOTA DE CRÉDITO para anular esta factura?\n\nComprobante: ${sale.document_type} ${String(sale.afip_cbte_nro).padStart(8, '0')}\nTotal: $${sale.total.toLocaleString()}`);
        
        if (!confirmNC) return;

        let issuer_cuit = sale.issuer_cuit;
        if (!issuer_cuit) {
            issuer_cuit = window.prompt("Ingrese el CUIT del Emisor para esta Nota de Crédito (Ej: 30716493365):");
            if (!issuer_cuit) return;
        }

        setLoading(true);
        try {
            const response = await fetch('http://localhost:3002/api/afip/credit-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cuit_emisor: issuer_cuit,
                    importe_total: sale.total,
                    tipo_doc: sale.customer?.cuit ? 80 : 99,
                    nro_doc: sale.customer?.cuit ? parseInt(sale.customer.cuit.replace(/[^0-9]/g, '')) : 0,
                    original_tipo_comprobante: sale.document_type === 'FACTURA_A' ? 1 : sale.document_type === 'FACTURA_B' ? 6 : 11,
                    original_punto_venta: sale.afip_pto_vta,
                    original_cbte_nro: sale.afip_cbte_nro
                })
            });

            const data = await response.json();
            if (!data.success) {
                alert('Error AFIP NC: ' + (data.error || 'Fallo en la generación'));
                setLoading(false);
                return;
            }

            // Actualizar la venta en Supabase con los datos de la NC
            const { error: updateError } = await supabase
                .from('sales')
                .update({
                    afip_nc_cae: data.cae,
                    afip_nc_cbte_nro: data.cbte_nro,
                    afip_nc_vto_cae: data.vto_cae ? new Date(data.vto_cae.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toISOString() : null
                })
                .eq('id', sale.id);

            if (updateError) {
                console.error('Error actualizando venta con NC:', updateError);
                alert('Error al guardar la NC en la base de datos: ' + updateError.message);
                setLoading(false);
                return;
            }

            // --- NUEVO: Registrar movimientos financieros y de stock ---
            
            // 1. Obtener sesión de caja abierta
            const { data: sessionData } = await supabase
                .from('cash_sessions')
                .select('id')
                .eq('status', 'ABIERTA')
                .order('opened_at', { ascending: false })
                .limit(1)
                .single();

            if (sessionData) {
                // 2. Registrar el egreso en la caja (devolución de dinero)
                await supabase.from('payments').insert([{
                    session_id: sessionData.id,
                    sale_id: sale.id,
                    amount: -sale.total,
                    method: 'EFECTIVO',
                    reference_code: `NC ${data.cbte_nro} (Anula ${sale.document_type})`
                }]);
            }

            // 3. Devolver stock e insertar movimientos de inventario
            if (sale.items && sale.items.length > 0) {
                for (const item of sale.items) {
                    // Actualizar stock actual
                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('stock_current')
                        .eq('product_id', item.product_id)
                        .single();
                    
                    if (invData) {
                        await supabase
                            .from('inventory')
                            .update({ stock_current: invData.stock_current + item.quantity })
                            .eq('product_id', item.product_id);
                    }

                    // Registrar movimiento de entrada (por devolución)
                    await supabase.from('inventory_movements').insert([{
                        product_id: item.product_id,
                        quantity: item.quantity,
                        type: 'RETURN',
                        description: `Devolución NC ${data.cbte_nro}`,
                        reference_id: sale.id
                    }]);
                }
            }

            alert(`¡Nota de Crédito generada con éxito!\nNúmero: NC ${data.cbte_nro}\nCAE: ${data.cae}\n\nSe ha registrado el egreso en caja y restaurado el stock.`);
            fetchSales();
        } catch (err: any) {
            alert('Error conectando con el servidor AFIP: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsApp = async (sale: any, isCreditNote: boolean = false) => {
        const phone = prompt("Ingresa el número de WhatsApp del cliente (ej: 1123456789):", sale.customer?.phone || "");
        if (!phone) return;

        setLoading(true);
        try {
            const { generateAndUploadTicketPDF } = await import('../lib/printer');
            const pdfUrl = await generateAndUploadTicketPDF(sale, isCreditNote);
            
            let docName = sale.afip_cae ? 'Factura' : 'Remito';
            if (isCreditNote) docName = 'Nota de Crédito';
            const text = `¡Hola! Aquí tienes tu comprobante de compra (${docName}) de Corralón El Líder:\n\n📄 Ver PDF: ${pdfUrl}\n\n¡Gracias por elegirnos!`;
            
            const waUrl = `https://wa.me/549${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
            window.open(waUrl, '_blank');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(s => 
        (s.customer?.name || 'CONSUMIDOR FINAL').toLowerCase().includes(search.toLowerCase()) ||
        (s.afip_cbte_nro || '').toString().includes(search) ||
        (s.order_number || '').toString().includes(search)
    );

    return (
        <div className={cn("space-y-6", isTab ? "pt-2" : "")}>
            <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center gap-4", isTab ? "md:justify-end" : "")}>
                {!isTab && (
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                            <History size={32} className="text-brand-blue" />
                            Historial de Ventas
                        </h1>
                        <p className="text-slate-500 font-medium">Consulta, reimprime y gestiona tus facturas y remitos.</p>
                    </div>
                )}
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <Input 
                        placeholder="Buscar por cliente, número o ticket..." 
                        className="pl-12 h-12"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <Card className="overflow-hidden border-none shadow-premium">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Comprobante</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado AFIP</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center text-slate-400 font-medium">Cargando ventas...</td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center text-slate-300">
                                        <History size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>No se encontraron registros de ventas.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{new Date(sale.created_at).toLocaleDateString('es-AR')}</span>
                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">
                                                    {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 tracking-tight">
                                                    {sale.afip_nc_cbte_nro 
                                                        ? `NC ${String(sale.afip_nc_cbte_nro).padStart(8, '0')}`
                                                        : (sale.afip_cbte_nro ? String(sale.afip_cbte_nro).padStart(8, '0') : `#${sale.order_number || sale.id.slice(0,8)}`)}
                                                </span>
                                                <Badge variant={sale.afip_nc_cae ? "red" : "slate"} className="w-fit text-[9px] px-1.5 h-4 mt-1">
                                                    {sale.afip_nc_cae ? 'NOTA DE CRÉDITO' : sale.document_type.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-slate-300" />
                                                <span className="font-medium text-slate-600">{sale.customer?.name || 'CONSUMIDOR FINAL'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 font-black text-slate-900">${sale.total.toLocaleString()}</td>
                                        <td className="p-4">
                                            {sale.afip_nc_cae ? (
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="red" className="w-fit">ANULADA (NC)</Badge>
                                                    <span className="text-[9px] font-mono text-slate-400">CAE NC: {sale.afip_nc_cae}</span>
                                                    <span className="text-[9px] font-bold text-slate-300">Origen: {sale.document_type.replace('_', ' ')} {String(sale.afip_cbte_nro).padStart(8, '0')}</span>
                                                </div>
                                            ) : sale.afip_cae ? (
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="green" className="w-fit">FACTURADO</Badge>
                                                    <span className="text-[9px] font-mono text-slate-400">CAE: {sale.afip_cae}</span>
                                                </div>
                                            ) : (
                                                <Badge variant="slate" className="opacity-50">SIN FE</Badge>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-2">
                                                {sale.afip_nc_cae ? (
                                                    <>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-9 px-3 text-rose-600 border-rose-100 hover:bg-rose-50"
                                                            onClick={() => handlePrint(sale, true)}
                                                            title="Imprimir Nota de Crédito"
                                                        >
                                                            <Printer size={16} className="mr-2" />
                                                            Ticket NC
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-9 px-3 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                                            onClick={() => handleWhatsApp(sale, true)}
                                                            disabled={loading}
                                                            title="Enviar NC por WhatsApp"
                                                        >
                                                            <MessageCircle size={16} />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-9 px-3 text-brand-blue border-blue-100 hover:bg-blue-50"
                                                            onClick={() => handlePrint(sale)}
                                                        >
                                                            <Printer size={16} className="mr-2" />
                                                            Ticket
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-9 px-3 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                                            onClick={() => handleWhatsApp(sale)}
                                                            disabled={loading}
                                                            title="Enviar PDF por WhatsApp"
                                                        >
                                                            <MessageCircle size={16} />
                                                        </Button>
                                                    </>
                                                )}
                                                {sale.afip_cae && !sale.afip_nc_cae && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-9 px-3 text-rose-600 border-rose-100 hover:bg-rose-50"
                                                        onClick={() => handleCreditNote(sale)}
                                                        disabled={loading}
                                                    >
                                                        <FileX size={16} className="mr-2" />
                                                        NC
                                                    </Button>
                                                )}
                                                {sale.customer?.phone && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-9 px-3 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                                        onClick={() => handleWhatsApp(sale)}
                                                    >
                                                        <MessageCircle size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
