import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Input } from '../components/ui';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  CreditCard,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  History,
  X,
  Upload,
  Download
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '../components/ui';

interface LedgerItem {
  id: string;
  type: 'DEBITO' | 'CREDITO';
  amount: number;
  description: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  cuit?: string;
  credit_limit: number;
  balance?: number;
}

const getAddresses = (addressString: string | undefined | null): string[] => {
  if (!addressString) return [];
  try {
     const parsed = JSON.parse(addressString);
     if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [addressString];
};

export const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customerForm, setCustomerForm] = useState({ id: '', name: '', phone: '', cuit: '', address: '', credit_limit: 10000 });
  const [multipleAddresses, setMultipleAddresses] = useState<string[]>([]);
  const [newAddressInput, setNewAddressInput] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDescription, setPaymentDescription] = useState('Pago de cuenta');
  const [onlyDebtors, setOnlyDebtors] = useState(false);



  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data: custData } = await supabase.from('customers').select('*');
    if (custData) {
      const enriched = await Promise.all(custData.map(async (c) => {
        const { data: ledgerData } = await supabase.from('customer_ledger').select('amount, type').eq('customer_id', c.id);
        const balance = (ledgerData || []).reduce((acc, curr) => curr.type === 'DEBITO' ? acc - curr.amount : acc + curr.amount, 0);
        return { ...c, balance };
      }));
      setCustomers(enriched);
    }
    setLoading(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert multiple addresses back to string
    let finalAddress = '';
    if (multipleAddresses.length > 0) {
      if (multipleAddresses.length === 1) finalAddress = multipleAddresses[0];
      else finalAddress = JSON.stringify(multipleAddresses);
    }

    const payload = { ...customerForm, address: finalAddress };

    if (isEditing) {
      const { id, ...updateData } = payload;
      const { error } = await supabase.from('customers').update(updateData).eq('id', id);
      if (error) {
        console.error('Error al actualizar cliente:', error);
        alert('Error al actualizar cliente: ' + error.message);
      } else {
        fetchCustomers();
        setIsCustomerModalOpen(false);
        if (selectedCustomer?.id === id) {
           setSelectedCustomer({ ...selectedCustomer, ...updateData });
        }
        alert('✅ Cliente actualizado correctamente');
      }
    } else {
      const { id, ...insertData } = payload;
      const { error } = await supabase.from('customers').insert([insertData]);
      if (error) {
        console.error('Error al crear cliente:', error);
        alert('Error al crear cliente: ' + error.message);
      } else {
        fetchCustomers();
        setIsCustomerModalOpen(false);
        alert('✅ Cliente creado correctamente');
      }
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.')) return;
    
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar cliente: ' + error.message);
    } else {
      setSelectedCustomer(null);
      fetchCustomers();
      alert('🗑️ Cliente eliminado');
    }
  };


  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const { error } = await supabase.from('customer_ledger').insert([{
      customer_id: selectedCustomer.id,
      amount: paymentAmount,
      type: 'CREDITO',
      description: paymentDescription
    }]);

    if (!error) {
      fetchCustomers();
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentDescription('Pago de cuenta');
      fetchLedger(selectedCustomer.id);
    }
  };
   


  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.phone?.includes(searchTerm);
    const matchesDebt = onlyDebtors ? (c.balance || 0) < 0 : true;
    return matchesSearch && matchesDebt;
  });



  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const processData = async (data: any[]) => {
        let imported = 0;
        let skipped = 0;
        
        for (const row of data) {
          try {
            const getField = (terms: string[]) => {
              const keys = Object.keys(row);
              const key = keys.find(k => terms.some(t => k.toUpperCase().includes(t.toUpperCase())));
              return key ? row[key] : null;
            };

            const name = getField(['NOMBRE', 'CLIENTE', 'RAZON SOCIAL', 'NAME']);
            const phone = getField(['TELEFONO', 'CELULAR', 'PHONE', 'WHATSAPP']);
            const address = getField(['DIRECCION', 'CALLE', 'ADDRESS', 'UBICACION']);
            const limit = getField(['LIMITE', 'CREDITO', 'LIMIT']);

            if (!name || String(name).trim() === '') {
              skipped++;
              continue;
            }

            await supabase.from('customers').insert([{
              name: String(name).trim(),
              phone: phone ? String(phone).trim() : null,
              address: address ? String(address).trim() : null,
              credit_limit: limit ? Number(String(limit).replace(/[$\s.,]/g, '')) : 50000
            }]);
            
            imported++;
          } catch (err) {
            console.error('Error en fila cliente:', err);
          }
        }
        
        alert(`Clientes importados: ${imported}\nOmitidos: ${skipped}`);
        fetchCustomers();
        setLoading(false);
      };

      if (file.name.endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          processData(XLSX.utils.sheet_to_json(ws));
        };
        reader.readAsBinaryString(file);
      } else {
        Papa.parse(file, {
          header: true,
          complete: (res) => processData(res.data),
          error: () => setLoading(false)
        });
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchLedger = async (customerId: string) => {
    const { data } = await supabase
      .from('customer_ledger')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    
    if (data) setLedger(data);
  };

  const handlePrintStatement = () => {
    if (!selectedCustomer) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Resumen de Cuenta - ${selectedCustomer.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1D1D4B; pb: 20px; mb: 40px; }
            h1 { margin: 0; color: #1D1D4B; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .debit { color: #be123c; font-weight: bold; }
            .credit { color: #059669; font-weight: bold; }
            .balance { font-size: 24px; font-weight: 900; text-align: right; margin-top: 40px; }
            .footer { margin-top: 60px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>EL LÍDER</h1>
              <p>Materiales para la Construcción</p>
            </div>
            <div style="text-align: right">
              <h3>Resumen de Cuenta</h3>
              <p>Fecha: ${new Date().toLocaleDateString('es-AR')}</p>
            </div>
          </div>
          
          <div style="margin-bottom: 30px">
            <p><strong>Cliente:</strong> ${selectedCustomer.name}</p>
            <p><strong>Teléfono:</strong> ${selectedCustomer.phone || '-'}</p>
            <p><strong>Dirección:</strong> ${selectedCustomer.address || '-'}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Movimiento</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map(item => `
                <tr>
                  <td>${new Date(item.created_at).toLocaleDateString('es-AR')}</td>
                  <td>${item.description}</td>
                  <td>${item.type === 'DEBITO' ? 'Deuda' : 'Pago'}</td>
                  <td class="${item.type === 'DEBITO' ? 'debit' : 'credit'}">
                    ${item.type === 'CREDITO' ? '+' : '-'} $${item.amount.toLocaleString()}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="balance">
            SALDO ACTUAL: $${(selectedCustomer.balance || 0).toLocaleString()}
          </div>

          <div class="footer">
            Documento no válido como factura. Reservados todos los derechos de Corralón El Líder.
          </div>
          
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* List */}
      <div className="lg:col-span-1 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users size={28} className="text-brand-blue" />
            Clientes
          </h1>
          <Button variant="outline" className="h-8 w-8 p-0 rounded-lg" onClick={() => {
            setIsEditing(false);
            setCustomerForm({ id: '', name: '', phone: '', cuit: '', address: '', credit_limit: 10000 });
            setMultipleAddresses([]);
            setNewAddressInput('');
            setIsCustomerModalOpen(true);
          }}>
            <Plus size={18} />
          </Button>

        </div>

        <Card className="p-2 flex items-center gap-2">
          <Search size={18} className="text-slate-400 ml-2" />
          <input 
            placeholder="Buscar cliente..." 
            className="w-full bg-transparent p-2 text-sm outline-none" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Card>

        <div className="flex gap-2">
          <Button 
            className={cn(
              "flex-1 h-10 text-[10px] font-black uppercase tracking-widest gap-2",
              onlyDebtors ? "bg-rose-500 text-white" : "bg-white text-slate-400 border border-slate-100"
            )}
            onClick={() => setOnlyDebtors(!onlyDebtors)}
          >
            <TrendingDown size={14} /> Solo Deudores
          </Button>
        </div>

        <div className="flex gap-2">
           <label className="flex-1 cursor-pointer">
             <input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleBulkUpload} />
             <div className="w-full btn-secondary flex items-center justify-center gap-2 h-10 px-4 text-xs font-bold uppercase tracking-widest">
               <Upload size={14} /> Importar Excel
             </div>
           </label>
        </div>


        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
          {filteredCustomers.map(c => (
            <div 
              key={c.id}
              onClick={() => {
                setSelectedCustomer(c);
                fetchLedger(c.id);
              }}
              className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer",
                selectedCustomer?.id === c.id 
                  ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-blue-500/20' 
                  : 'bg-white border-slate-100 hover:border-brand-blue/30 shadow-sm'
              )}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="font-bold">{c.name}</h3>
                  <div className="flex items-center gap-1 opacity-70 text-[10px] font-bold uppercase tracking-widest">
                    <Phone size={10} /> {c.phone || 'S/T'}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-lg font-black",
                    (c.balance || 0) < 0 ? (selectedCustomer?.id === c.id ? 'text-rose-300' : 'text-rose-600') : (selectedCustomer?.id === c.id ? 'text-emerald-300' : 'text-emerald-600')
                  )}>
                    ${(c.balance || 0).toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold opacity-60 uppercase">Saldo Actual</p>
                </div>
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Details & Ledger */}
      <div className="lg:col-span-2 space-y-6">
        {selectedCustomer ? (
          <>
            <div className="flex justify-between items-start bg-white p-8 rounded-3xl shadow-premium border border-slate-100">
               <div className="space-y-4">
                 <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-brand-blue">
                   <Users size={32} />
                 </div>
                 <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <h2 className="text-3xl font-black text-slate-900">{selectedCustomer.name}</h2>
                     <div className="flex gap-2">
                       <Button variant="outline" className="h-8 px-3 py-0 text-xs" onClick={() => {
                         setCustomerForm({
                           id: selectedCustomer.id,
                           name: selectedCustomer.name,
                           phone: selectedCustomer.phone || '',
                           cuit: selectedCustomer.cuit || '',
                           address: selectedCustomer.address || '',
                           credit_limit: selectedCustomer.credit_limit
                         });
                         setMultipleAddresses(getAddresses(selectedCustomer.address));
                         setNewAddressInput('');
                         setIsEditing(true);
                         setIsCustomerModalOpen(true);
                       }}>Editar</Button>
                       <Button variant="danger" className="h-8 px-3 py-0 text-xs shadow-none" onClick={() => handleDeleteCustomer(selectedCustomer.id)}>Eliminar</Button>
                     </div>
                   </div>
                     <div className="flex items-center gap-4 mt-2 text-slate-500 font-medium text-sm flex-wrap">
                      <span className="flex items-center gap-1"><Phone size={16} /> {selectedCustomer.phone}</span>
                      <span className="flex items-start gap-1">
                        <MapPin size={16} className="mt-0.5" /> 
                        <div className="flex flex-col">
                          {getAddresses(selectedCustomer.address).length > 0 ? (
                             getAddresses(selectedCustomer.address).map((addr, i) => (
                               <span key={i}>{addr}</span>
                             ))
                          ) : (
                             <span>-</span>
                          )}
                        </div>
                      </span>
                      {selectedCustomer.cuit && <Badge variant="blue" className="font-mono mt-1">CUIT: {selectedCustomer.cuit}</Badge>}
                    </div>
                 </div>
               </div>
               <div className="text-right space-y-2">
                 <Badge variant={(selectedCustomer.balance || 0) < 0 ? 'red' : 'green'}>
                    {(selectedCustomer.balance || 0) < 0 ? 'Con Deuda' : 'Al Día'}
                 </Badge>
                 <div className="flex flex-col">
                   <span className="text-4xl font-black text-slate-900">${(selectedCustomer.balance || 0).toLocaleString()}</span>
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo en Cuenta</span>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <Card className="bg-emerald-50 border-emerald-100 p-6 flex justify-between items-center">
                 <div>
                   <p className="text-emerald-700 font-bold text-xs uppercase tracking-widest">Límite de Crédito</p>
                   <h4 className="text-2xl font-black text-emerald-900">${selectedCustomer.credit_limit.toLocaleString()}</h4>
                 </div>
                 <CreditCard size={32} className="text-emerald-300" />
               </Card>
                <div className="flex flex-col gap-3">
                  <Button 
                    className="h-12 rounded-2xl flex items-center justify-center gap-2 px-6 bg-brand-blue"
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    <Plus size={18} />
                    <span className="text-xs font-black uppercase">Registrar Pago</span>
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-12 rounded-2xl flex items-center justify-center gap-2 px-6 bg-white border-slate-100 text-slate-500"
                    onClick={handlePrintStatement}
                  >
                    <Download size={18} />
                    <span className="text-xs font-black uppercase">Imprimir Resumen</span>
                  </Button>
                </div>
            </div>

            <Card className="p-0 border-none shadow-premium overflow-hidden">
               <div className="p-6 bg-slate-50 flex items-center justify-between">
                 <h3 className="font-black text-slate-900 flex items-center gap-2">
                   <History size={20} className="text-slate-400" />
                   Movimientos Recientes
                 </h3>
                 <Button variant="ghost" className="text-xs">Ver Todo <ChevronRight size={14}/></Button>
               </div>
               <div className="divide-y divide-slate-100">
                 {ledger.length === 0 ? (
                   <div className="p-12 text-center text-slate-400 italic">No hay movimientos registrados.</div>
                 ) : (
                   ledger.map(item => (
                     <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                       <div className="flex items-center gap-4">
                         <div className={cn(
                           "p-2 rounded-xl",
                           item.type === 'CREDITO' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                         )}>
                           {item.type === 'CREDITO' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                         </div>
                         <div>
                           <p className="font-bold text-slate-800">{item.description}</p>
                           <p className="text-xs text-slate-400 font-medium">
                             {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                           </p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className={cn("font-black text-lg", item.type === 'CREDITO' ? 'text-emerald-600' : 'text-rose-600')}>
                           {item.type === 'CREDITO' ? '+' : '-'} ${item.amount.toLocaleString()}
                         </p>
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </Card>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6 text-center px-12">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-premium flex items-center justify-center">
              <Users size={64} strokeWidth={1} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-400">Seleccioná un Cliente</h2>
              <p className="text-sm font-medium mt-2">Podrás ver su deuda, movimientos e historial de pagos.</p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-md p-8 relative">
              <button 
                onClick={() => setIsCustomerModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue">
                  <Plus size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              </div>

              <form onSubmit={handleSaveCustomer} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Completo / Razón Social</label>
                  <Input 
                    required 
                    value={customerForm.name}
                    onChange={e => setCustomerForm({...customerForm, name: e.target.value})}
                    placeholder="Ej: Juan Pérez" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono</label>
                    <Input 
                      value={customerForm.phone}
                      onChange={e => setCustomerForm({...customerForm, phone: e.target.value})}
                      placeholder="11 1234 5678" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CUIT (Sólo Factura A)</label>
                    <Input 
                      value={customerForm.cuit}
                      onChange={e => setCustomerForm({...customerForm, cuit: e.target.value})}
                      placeholder="30-XXXXXXXX-X" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Límite de Crédito</label>
                    <Input 
                      type="number"
                      value={customerForm.credit_limit}
                      onChange={e => setCustomerForm({...customerForm, credit_limit: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Direcciones de Entrega (Obras)</label>
                  <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                     {multipleAddresses.map((addr, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 px-3 rounded-xl shadow-sm border border-slate-100 text-sm">
                           <span>{addr}</span>
                           <button type="button" onClick={() => setMultipleAddresses(multipleAddresses.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700">
                             <X size={16} />
                           </button>
                        </div>
                     ))}
                     
                     <div className="flex gap-2 mt-1">
                       <Input 
                         value={newAddressInput}
                         onChange={e => setNewAddressInput(e.target.value)}
                         placeholder="Ej: Obra Barrio Cerrado Lote 45..." 
                         className="flex-1 text-sm bg-white"
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             e.preventDefault();
                             if (newAddressInput.trim()) {
                               setMultipleAddresses([...multipleAddresses, newAddressInput.trim()]);
                               setNewAddressInput('');
                             }
                           }
                         }}
                       />
                       <Button 
                         type="button"
                         variant="secondary"
                         onClick={() => {
                           if (newAddressInput.trim()) {
                             setMultipleAddresses([...multipleAddresses, newAddressInput.trim()]);
                             setNewAddressInput('');
                           }
                         }}
                       >
                         Añadir
                       </Button>
                     </div>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 mt-4 font-black">{isEditing ? 'GUARDAR CAMBIOS' : 'CREAR CLIENTE'}</Button>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>

      {/* Register Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-md p-8 relative">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registrar Pago</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase">{selectedCustomer.name}</p>
                </div>
              </div>

              <form onSubmit={handleRegisterPayment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monto del Pago ($)</label>
                  <Input 
                    required 
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                    placeholder="0.00" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descripción / Notas</label>
                  <Input 
                    required 
                    value={paymentDescription}
                    onChange={e => setPaymentDescription(e.target.value)}
                    placeholder="Ej: Pago efectivo en mostrador" 
                  />
                </div>
                <Button type="submit" className="w-full h-12 mt-4 font-black bg-emerald-600 hover:bg-emerald-700">
                  CONFIRMAR PAGO
                </Button>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>
    </div>


  );
};
