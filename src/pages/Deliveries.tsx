import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Input } from '../components/ui';
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Search,
  ChevronRight,
  ExternalLink,
  Phone,
  FileText,
  Package,
  Layers,
  X
} from 'lucide-react';
import { cn } from '../components/ui';
import { AnimatePresence, motion } from 'framer-motion';

interface Delivery {
  id: string;
  status: 'PENDIENTE' | 'EN_CAMINO' | 'ENTREGADO' | 'FALLIDO';
  scheduled_date: string;
  address: string;
  tracking_notes: string;
  sale: {
    id: string;
    total: number;
    customer: { name: string; phone: string };
    sale_items: Array<{
      quantity: number;
      products: { name: string; unit: string };
    }>;
  };
}

export const Deliveries = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDIENTE');
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    fetchDeliveries();
  }, [filter]);

  const fetchDeliveries = async () => {
    setLoading(true);
    // Join with sales and customers
    const { data } = await supabase
      .from('deliveries')
      .select('*, sale:sales(id, total, customer:customers(name, phone), sale_items(quantity, products(name, unit)))')
      .order('scheduled_date', { ascending: true });
    
    if (data) setDeliveries(data);
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('deliveries').update({ status: newStatus }).eq('id', id);
    if (!error) {
      if (newStatus === 'ENTREGADO') {
        // Also update the related sale's delivery_status
        const delivery = (deliveries as any[]).find(d => d.id === id);
        if (delivery?.sale?.id) {
          await supabase.from('sales').update({ delivery_status: 'ENTREGADO' }).eq('id', delivery.sale.id);
        }
      }
      fetchDeliveries();
    }
  };

  const handlePrintLoadingSheet = () => {
    const list = filter === 'ENTREGADO' ? deliveries : deliveries.filter(d => d.status === filter);
    if (list.length === 0) return;

    // Aggregate items and estimate weights
    const aggregated: Record<string, { quantity: number; unit: string; weight: number }> = {};
    let totalWeight = 0;

    const getEstimatedWeight = (name: string, unit: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('cemento')) return 50;
      if (lower.includes('cal ')) return 25;
      if (lower.includes('arena')) return 30; // approx per unit or bolson
      if (lower.includes('ladrillo')) return 2; // approx per unit
      if (unit === 'BOLSON') return 1000;
      if (unit === 'METRO' || unit === 'M3') return 1500;
      return 1; // Default 1kg
    };

    list.forEach(d => {
      const items = (d as any).sale?.sale_items || [];
      items.forEach((item: any) => {
        const name = item.products?.name || 'Producto Desconocido';
        const unit = item.products?.unit || 'UNID';
        const weightPerUnit = getEstimatedWeight(name, unit);

        if (!aggregated[name]) {
          aggregated[name] = { quantity: 0, unit, weight: 0 };
        }
        aggregated[name].quantity += Number(item.quantity || 0);
        aggregated[name].weight += Number(item.quantity || 0) * weightPerUnit;
        totalWeight += Number(item.quantity || 0) * weightPerUnit;
      });
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Hoja de Carga - ${new Date().toLocaleDateString('es-AR')}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            h1 { color: #1D1D4B; border-bottom: 2px solid #1D1D4B; padding-bottom: 10px; }
            .meta { margin-bottom: 30px; font-weight: bold; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f1f5f9; padding: 12px; border: 1px solid #e2e8f0; }
            td { padding: 12px; border: 1px solid #e2e8f0; font-size: 16px; font-weight: bold; }
            .qty { color: #1D1D4B; font-size: 20px; }
            .check { width: 30px; border: 2px solid #cbd5e1; height: 30px; display: inline-block; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; pt: 10px; }
          </style>
        </head>
        <body>
          <h1>HOJA DE CARGA CONSOLIDADA</h1>
          <div class="meta">
            Estado: ${filter} | Fecha: ${new Date().toLocaleDateString('es-AR')} | Total Entregas: ${list.length} | <b>PESO TOTAL ESTIMADO: ${(totalWeight / 1000).toFixed(2)} TON</b>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px">OK</th>
                <th>Producto / Item</th>
                <th style="text-align: right">Cantidad Total</th>
                <th style="text-align: right">Peso Est.</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(aggregated).map(([name, data]) => `
                <tr>
                  <td><div class="check"></div></td>
                  <td>${name}</td>
                  <td style="text-align: right" class="qty">${data.quantity} ${data.unit}</td>
                  <td style="text-align: right">${data.weight >= 1000 ? (data.weight / 1000).toFixed(2) + ' TN' : data.weight + ' KG'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px">
            <h3>Entregas Incluidas en este Viaje:</h3>
            <ul style="font-size: 12px; color: #475569">
              ${list.map(d => `<li>Venta #${d.sale?.id.slice(0,6)} - ${d.sale?.customer.name} (${d.address})</li>`).join('')}
            </ul>
          </div>

          <div class="footer">
            Generado por Sistema de Gestión El Líder
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const openMap = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };


  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDIENTE': return 'bg-amber-100 text-amber-700';
      case 'EN_CAMINO': return 'bg-blue-100 text-blue-700';
      case 'ENTREGADO': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
             <Truck size={32} className="text-brand-red" />
             Logística y Entregas
           </h1>
           <p className="text-slate-500 font-medium mt-1">Coordinación de envíos propios y retiro por mostrador.</p>
        </div>
        
        <div className="flex gap-4">
           <Button 
            variant="outline" 
            className="h-10 px-6 border-brand-red text-brand-red hover:bg-brand-red hover:text-white flex items-center gap-2"
            onClick={handlePrintLoadingSheet}
            disabled={deliveries.length === 0}
           >
              <FileText size={18} /> Hoja de Carga
           </Button>

           <div className="flex gap-2 p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
              {['PENDIENTE', 'EN_CAMINO', 'ENTREGADO'].map(s => (
                <button 
                 key={s} 
                 onClick={() => setFilter(s)}
                 className={cn(
                   "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                   filter === s ? "bg-brand-blue text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                 )}
                >
                  {s === 'PENDIENTE' ? 'Próximos' : s}
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="p-6 space-y-4">
             <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Hoy</h3>
             <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-500">Total Programados</span>
                 <span className="text-xl font-black text-slate-900">{deliveries.length}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-500">Para Retirar</span>
                 <span className="text-xl font-black text-brand-red">3</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-500">Pendientes</span>
                 <span className="text-xl font-black text-amber-600">
                    {deliveries.filter(d => d.status === 'PENDIENTE').length}
                 </span>
               </div>
             </div>
             <Button className="w-full mt-4">Programar Nueva Entrega</Button>
           </Card>

           <Card className="p-6 bg-slate-900 text-white border-none space-y-4 relative overflow-hidden">
             <Truck className="absolute -bottom-4 -right-4 opacity-10 w-24 h-24" rotate={-15} />
             <h3 className="font-black uppercase text-xs tracking-widest text-emerald-400">Estado de Flota</h3>
             <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold">Camión IVECO - En camino</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-bold">Camioneta Ford - Cargando</span>
                </div>
             </div>
           </Card>
        </div>

        {/* List */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
             <div className="p-20 text-center font-black text-slate-300 animate-pulse uppercase tracking-[0.3em]">Cargando Hoja de Ruta...</div>
          ) : deliveries.length === 0 ? (
             <div className="p-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-300 space-y-4 uppercase tracking-widest font-black">
                <Calendar size={64} className="mx-auto" strokeWidth={1} />
                <p>No hay entregas registradas</p>
             </div>
          ) : (
             deliveries.map(d => (
               <Card key={d.id} className="p-0 border-none shadow-premium overflow-hidden bg-white hover:shadow-2xl transition-all group">
                 <div className="flex flex-col md:flex-row">
                   <div className="p-6 md:w-48 bg-slate-50 flex flex-col items-center justify-center border-r border-slate-100 group-hover:bg-brand-red group-hover:text-white transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Fecha</span>
                      <span className="text-2xl font-black">{new Date(d.scheduled_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
                      <span className="text-xs font-bold mt-1">Venta #{d.sale?.id.slice(0,6)}</span>
                   </div>
                   
                   <div className="flex-1 p-6 flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4">
                         <div className="flex items-center gap-3">
                             <Badge variant="custom" className={cn("px-4 py-1.5", getStatusStyle(d.status))}>{d.status}</Badge>
                             <span className="text-lg font-black text-slate-900">{d.sale?.customer?.name || 'Consumidor Final'}</span>
                         </div>
                         <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                               <MapPin size={16} className="text-slate-300" /> {d.address}
                            </div>
                             <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                <Phone size={16} className="text-slate-300" /> {d.sale?.customer?.phone || 'Sin teléfono'}
                             </div>
                          </div>
                          
                          <div className="pt-2">
                             <Button 
                               variant="ghost" 
                               className="h-8 px-3 text-[10px] font-black uppercase text-brand-blue bg-blue-50 hover:bg-blue-100"
                               onClick={() => {
                                 setSelectedDelivery(d);
                                 setIsItemsModalOpen(true);
                               }}
                             >
                                <Package size={14} className="mr-2" />
                                Ver {((d.sale as any)?.sale_items || []).length} Artículos
                             </Button>
                          </div>
                       </div>

                      <div className="flex md:flex-col justify-end gap-2">
                         <Button 
                           variant="outline" 
                           className="h-10 px-4 group-hover:border-slate-300"
                           onClick={() => openMap(d.address)}
                         >
                           <ExternalLink size={16} /> Mapa
                         </Button>
                         {d.status !== 'ENTREGADO' && (
                           <Button 
                             variant="secondary" 
                             className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700"
                             onClick={() => updateStatus(d.id, 'ENTREGADO')}
                           >
                             <CheckCircle2 size={16} /> Entregado
                           </Button>
                         )}
                      </div>

                   </div>
                 </div>
               </Card>
             ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isItemsModalOpen && selectedDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
             >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
                         <Layers size={20} />
                      </div>
                      <div>
                         <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Detalle de Carga</h3>
                         <p className="text-[10px] font-bold text-slate-400">Venta #{selectedDelivery.sale?.id.slice(0,6)}</p>
                      </div>
                   </div>
                   <button onClick={() => setIsItemsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                      <X size={20} />
                   </button>
                </div>

                <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                   {((selectedDelivery.sale as any)?.sale_items || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                         <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-xs font-black shadow-sm border border-slate-200">
                               {item.quantity}
                            </div>
                            <span className="font-bold text-slate-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{item.products?.name}</span>
                         </div>
                         <Badge variant="blue" className="text-[9px]">{item.products?.unit}</Badge>
                      </div>
                   ))}
                </div>

                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                   <div>
                      <p className="text-[10px] font-black uppercase opacity-60">Dirección</p>
                      <p className="text-xs font-bold truncate max-w-[250px]">{selectedDelivery.address}</p>
                   </div>
                   <Button onClick={() => setIsItemsModalOpen(false)} className="bg-brand-red text-white hover:bg-brand-red/90 h-10 px-6 font-black text-xs">LISTO</Button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
