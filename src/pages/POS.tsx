import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Input } from '../components/ui';
import { Search, ShoppingCart, Users, Plus, Minus, X, MessageCircle, FileText, CheckCircle2, CreditCard, Banknote } from 'lucide-react';
import { cn } from '../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { printTicket } from '../lib/printer';


interface Product {
  id: string;
  name: string;
  internal_code: string;
  unit: string;
  price_base: number;
  prices: { price: number; price_list_id: string; min_quantity: number }[];
  category?: { name: string };
  inventory?: { stock_current: number };
}


interface Customer {
  id: string;
  name: string;
  price_list_id: string;
  phone?: string;
  cuit?: string;
}

export const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<{ product: Product; qty: number; price: number }[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [saleResult, setSaleResult] = useState<any>(null);

  const [activeSession, setActiveSession] = useState<any>(null);
  const [documentType, setDocumentType] = useState('REMITO');
  const [cuitEmisor, setCuitEmisor] = useState('30716493365');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [systemAmount, setSystemAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [deliveryMode, setDeliveryMode] = useState<'MOSTRADOR' | 'ENTREGA'>('MOSTRADOR');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCustomers();
    fetchSession();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch]);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, price_list_id, phone, cuit').limit(50);
    if (data) setCustomers(data);
  };

  const fetchSession = async () => {
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'ABIERTA')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data) setActiveSession(data);
  };


  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, prices:product_prices(price, price_list_id, min_quantity), category:categories(name), inventory:inventory(stock_current)')
      .eq('active', true);
    
    if (debouncedSearch) {
      query = query.or(`name.ilike.%${debouncedSearch}%,internal_code.ilike.%${debouncedSearch}%`);
    }

    const { data } = await query.limit(24);
    if (data) setProducts(data);
    setLoading(false);
  };

  const filteredProducts = products;

  const findProductPrice = (product: Product) => {
    if (!selectedCustomer?.price_list_id) return product.price_base;
    const priceObj = product.prices.find(p => p.price_list_id === selectedCustomer.price_list_id);
    return priceObj ? priceObj.price : product.price_base;
  };

  const addToCart = (product: Product) => {
    const price = findProductPrice(product);
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1, price }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item => item.product.id === id ? { ...item, qty: newQty } : item));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  useEffect(() => {
    if (paymentMode === 'SINGLE') {
      if (paymentMethod === 'EFECTIVO') {
        setCashAmount(total);
        setSystemAmount(0);
      } else {
        setCashAmount(0);
        setSystemAmount(total);
      }
    }
  }, [total, paymentMethod, paymentMode]);

  const handleFinalize = async (isQuote = false) => {
    if (cart.length === 0) return;

    if (!isQuote && documentType === 'FACTURA_A' && (!selectedCustomer || !selectedCustomer.cuit)) {
      alert('Error: Para emitir una FACTURA A es obligatorio seleccionar un cliente que tenga un CUIT cargado.');
      return;
    }
    
    const { data: latestSession } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'ABIERTA')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (!isQuote && !latestSession) {
      alert('¡ATENCIÓN! La caja aparece como CERRADA.');
      return;
    }
    
    setLoading(true);
    const sessionToUse = latestSession || activeSession;

    const insertData: any = {
      customer_id: selectedCustomer?.id || null,
      total,
      document_type: documentType
    };
    
    // Llamar a AFIP si es factura y hay CUIT Emisor
    let afipData = null;
    const isFactura = documentType.startsWith('FACTURA');

    if (!isQuote && isFactura) {
      if (!cuitEmisor) {
        alert('Error: Debes ingresar el CUIT del Emisor para generar una Factura Electrónica.');
        setLoading(false);
        return;
      }

      try {
        const afipResponse = await fetch('http://localhost:3002/api/afip/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cuit_emisor: cuitEmisor,
            importe_total: total,
            concepto: 1, // 1 = Productos
            tipo_comprobante: documentType === 'FACTURA_A' ? 1 : documentType === 'FACTURA_B' ? 6 : 11,
            tipo_doc: selectedCustomer?.cuit ? 80 : 99, // 80: CUIT, 99: Consumidor Final
            nro_doc: selectedCustomer?.cuit ? parseInt(selectedCustomer.cuit.replace(/[^0-9]/g, '')) : 0,
          })
        });
        const afipJson = await afipResponse.json();
        if (!afipJson.success) {
          alert('Error AFIP: ' + (afipJson.error || 'Generación fallida'));
          setLoading(false);
          return;
        }
        afipData = afipJson;
      } catch (err: any) {
        alert('Error contectando con el servidor AFIP local: ' + err.message);
        setLoading(false);
        return;
      }
    }

    if (afipData) {
      insertData.afip_cae = afipData.cae;
      insertData.afip_vto_cae = afipData.vto_cae ? new Date(afipData.vto_cae.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toISOString() : null;
      insertData.afip_pto_vta = afipData.pto_vta;
      insertData.afip_cbte_nro = afipData.cbte_nro;
      insertData.issuer_cuit = cuitEmisor;
    }

    if (isQuote) {
      insertData.status = 'PENDIENTE';
    } else {
      insertData.payment_status = (cashAmount + systemAmount) >= total ? 'COMPLETO' : 'PARCIAL';
      insertData.delivery_status = 'PENDIENTE';
    }

    const { data: entry, error } = await supabase
      .from(isQuote ? 'quotes' : 'sales')
      .insert(insertData)
      .select()
      .single();

    if (error) {
       console.error('Error insertando venta:', error);
       alert('Error al registrar la venta en la base de datos: ' + error.message);
       setLoading(false);
       return;
    }

    const entryId = entry.id;
    const friendlyId = entry.order_number ? `#${entry.order_number}` : `#${entryId.slice(0,8)}`;

    setSaleResult({ 
      id: entryId, 
      order_number: entry.order_number, 
      type: documentType, 
      items: [...cart], 
      total, 
      customer: selectedCustomer, 
      method: paymentMethod,
      afip_cae: insertData.afip_cae,
      afip_vto_cae: insertData.afip_vto_cae,
      afip_cbte_nro: insertData.afip_cbte_nro
    });

    const items = cart.map(item => ({
      [isQuote ? 'quote_id' : 'sale_id']: entryId,
      product_id: item.product.id,
      quantity: item.qty,
      unit_price: item.price,
      subtotal: item.qty * item.price
    }));

    await supabase.from(isQuote ? 'quote_items' : 'sale_items').insert(items);
    
    if (!isQuote) {
      const movements = cart.map(item => ({
        product_id: item.product.id,
        quantity: -item.qty,
        type: 'SALE',
        description: `Venta ${friendlyId}`,
        reference_id: entryId
      }));
      await supabase.from('inventory_movements').insert(movements);

      for (const item of cart) {
        const currentStock = item.product.inventory?.stock_current || 0;
        await supabase
          .from('inventory')
          .update({ stock_current: currentStock - item.qty })
          .eq('product_id', item.product.id);
      }

      if (selectedCustomer) {
        await supabase.from('customer_ledger').insert([{
          customer_id: selectedCustomer.id,
          amount: total,
          type: 'DEBITO',
          description: `Venta ${friendlyId}`,
          reference_id: entryId
        }]);

        if (cashAmount > 0) {
          await supabase.from('payments').insert([{ sale_id: entryId, session_id: sessionToUse?.id, amount: cashAmount, method: 'EFECTIVO' }]);
          await supabase.from('customer_ledger').insert([{ customer_id: selectedCustomer.id, amount: cashAmount, type: 'CREDITO', description: `Pago Efectivo Venta ${friendlyId}`, reference_id: entryId }]);
        }

        if (systemAmount > 0) {
          await supabase.from('payments').insert([{ sale_id: entryId, session_id: sessionToUse?.id, amount: systemAmount, method: 'TARJETA' }]);
          await supabase.from('customer_ledger').insert([{ customer_id: selectedCustomer.id, amount: systemAmount, type: 'CREDITO', description: `Pago MP/Transf Venta ${friendlyId}`, reference_id: entryId }]);
        }
      } else {
        if (cashAmount > 0) await supabase.from('payments').insert([{ sale_id: entryId, session_id: sessionToUse?.id, amount: cashAmount, method: 'EFECTIVO' }]);
        if (systemAmount > 0) await supabase.from('payments').insert([{ sale_id: entryId, session_id: sessionToUse?.id, amount: systemAmount, method: 'TARJETA' }]);
      }

      // 4. Delivery creation if requested
      if (deliveryMode === 'ENTREGA') {
        await supabase.from('deliveries').insert([{
           sale_id: entryId,
           status: 'PENDIENTE',
           address: deliveryAddress || 'Consultar con cliente',
           scheduled_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow default
           tracking_notes: `Venta #${friendlyId} - Entregar con urgencia.`
        }]);
      }
    }

    setLoading(false);
    setIsSuccess(true);
    setCart([]);
    setTimeout(() => {
      if (!isQuote) setIsSuccess(false);
    }, 10000); // 10s wait for Success view
  };

  const handlePrintTicket = () => {
    if (!saleResult) return;
    const saleData = {
      ...saleResult,
      customer_name: saleResult.customer?.name || 'CONSUMIDOR FINAL',
      customer_cuit: saleResult.customer?.cuit,
      type: saleResult.type
    };
    printTicket(saleData);
  };

  const handleWhatsAppShare = async () => {
    if (!saleResult || !selectedCustomer?.phone) {
      if (!selectedCustomer?.phone) alert('El cliente no tiene un teléfono registrado.');
      return;
    }
    
    setLoading(true);
    try {
      const saleData = {
        ...saleResult,
        customer_name: saleResult.customer?.name || 'CONSUMIDOR FINAL',
        customer_cuit: saleResult.customer?.cuit,
        type: saleResult.type
      };
      
      const { generateAndUploadTicketPDF } = await import('../lib/printer');
      const pdfUrl = await generateAndUploadTicketPDF(saleData);

      const phone = selectedCustomer.phone.replace(/[^0-9]/g, '');
      const docName = saleResult.afip_cae ? 'Factura' : 'Remito';
      const text = `¡Hola! Aquí tienes tu comprobante de compra (${docName}) de Corralón El Líder:\n\n📄 Ver PDF: ${pdfUrl}\n\n¡Gracias por tu compra!`;
      
      window.open(`https://wa.me/${phone.startsWith('54') ? phone : '54' + phone}?text=${encodeURIComponent(text)}`, '_blank');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      {/* Search & Products */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        <Card className="p-4 flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input 
              placeholder="Buscar por nombre, código o categoría..." 
              className="pl-12 py-3 text-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 px-6">
            <Plus size={20}/> Escanear
          </Button>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-6">
          <AnimatePresence>
            {filteredProducts.map(product => (
              <motion.div
                layout
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => addToCart(product)}
                className="group p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-brand-blue/20 cursor-pointer transition-all active:scale-95"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">{product.internal_code}</p>
                    <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-brand-blue transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="slate">{product.unit}</Badge>
                    <Badge 
                      variant={(product.inventory?.stock_current || 0) <= 0 ? 'red' : (product.inventory?.stock_current || 0) < 10 ? 'orange' : 'green'}
                      className="text-[9px] px-1.5 h-4"
                    >
                      Stock: {product.inventory?.stock_current || 0}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-2xl font-black text-slate-900">
                    ${findProductPrice(product).toLocaleString()}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-red group-hover:text-white transition-all shadow-sm">
                    <Plus size={24} />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

        </div>
      </div>

      {/* Cart & Customer */}
      <div className="flex flex-col gap-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-3">
             <Users size={20} className="text-brand-blue" />
             <span>Cliente</span>
          </div>
          <select 
            className="w-full input-standard text-sm cursor-pointer relative z-50"
            value={selectedCustomer?.id || ""}
            onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
          >
            <option value="">Consumidor Final</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedCustomer && (
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-xs">
              <p className="font-bold text-brand-blue uppercase">Lista de Precios:</p>
              <p className="text-slate-600">Minorista (Público)</p>
            </div>
          )}
        </Card>

        <Card className="flex-1 flex flex-col p-5 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
             <div className="flex items-center gap-2 text-slate-800 font-bold">
               <ShoppingCart size={20} className="text-brand-red" />
               <span>Carrito</span>
             </div>
             <Badge variant="red">{cart.length}</Badge>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-50">
                <ShoppingCart size={64} strokeWidth={1} />
                <p className="text-sm font-medium">No hay productos seleccionados</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 space-y-3 group transition-all hover:bg-white hover:shadow-md">
                   <div className="flex justify-between items-start">
                     <div className="flex-1">
                       <p className="text-xs font-black text-slate-800 leading-tight line-clamp-2 uppercase tracking-tighter">{item.product.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold mt-1">$ {item.price.toLocaleString()} c/u</p>
                     </div>
                     <button 
                       onClick={() => removeFromCart(item.product.id)}
                       className="p-1.5 text-slate-300 hover:text-brand-red opacity-0 group-hover:opacity-100 transition-all"
                     >
                       <X size={14} />
                     </button>
                   </div>
                   
                   <div className="flex justify-between items-center">
                     <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-8">
                        <button 
                          className="px-2 hover:bg-slate-50 text-slate-400 border-r border-slate-100"
                          onClick={() => updateQty(item.product.id, item.qty - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <input 
                           type="number"
                           className="w-12 text-center text-xs font-black bg-transparent outline-none"
                           value={item.qty}
                           onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                        />
                        <button 
                          className="px-2 hover:bg-slate-50 text-brand-blue border-l border-slate-100"
                          onClick={() => updateQty(item.product.id, item.qty + 1)}
                        >
                          <Plus size={12} />
                        </button>
                     </div>
                     <span className="text-sm font-black text-slate-900">${(item.qty * item.price).toLocaleString()}</span>
                   </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total Estimado</span>
              <span className="text-3xl font-black text-brand-blue">${total.toLocaleString()}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Logística</span>
                  <div className="flex gap-1">
                     <button 
                       onClick={() => setDeliveryMode('MOSTRADOR')}
                       className={cn("px-2 py-1 rounded-lg", deliveryMode === 'MOSTRADOR' ? "bg-brand-blue text-white" : "bg-white text-slate-400 border border-slate-200")}
                     >Retiro</button>
                     <button 
                       onClick={() => setDeliveryMode('ENTREGA')}
                       className={cn("px-2 py-1 rounded-lg", deliveryMode === 'ENTREGA' ? "bg-brand-red text-white" : "bg-white text-slate-400 border border-slate-200")}
                     >Envío</button>
                  </div>
               </div>
               {deliveryMode === 'ENTREGA' && (
                 <Input 
                   placeholder="Dirección de entrega..." 
                   className="text-xs h-8"
                   value={deliveryAddress}
                   onChange={(e) => setDeliveryAddress(e.target.value)}
                 />
               )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="w-full text-xs h-10" onClick={() => handleFinalize(true)} disabled={cart.length === 0 || loading}>
                <FileText size={16} /> Cotizar
              </Button>
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Comprobante</label>
                 <select 
                   className="w-full h-8 text-[10px] font-black bg-slate-50 border border-slate-200 rounded-lg px-2 outline-none"
                   value={documentType}
                   onChange={(e) => setDocumentType(e.target.value)}
                 >
                   <option value="REMITO">REMITO (X)</option>
                   <option value="FACTURA_A">FACTURA A</option>
                   <option value="FACTURA_B">FACTURA B</option>
                   <option value="FACTURA_C">FACTURA C</option>
                 </select>
              </div>
            </div>
            

            <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex justify-between items-center">
                 <label className="text-[10px] font-black uppercase text-slate-400">Entrega del Cliente</label>
                 <button 
                   className="text-[9px] font-bold text-brand-blue underline"
                   onClick={() => setPaymentMode(paymentMode === 'SINGLE' ? 'SPLIT' : 'SINGLE')}
                 >
                   {paymentMode === 'SINGLE' ? 'PAGO DIVIDIDO' : 'PAGO ÚNICO'}
                 </button>
               </div>

               {paymentMode === 'SINGLE' ? (
                 <div className="flex gap-1">
                   {[
                     { id: 'EFECTIVO', icon: <Banknote size={16}/>, label: 'Efectivo' },
                     { id: 'TARJETA', icon: <CreditCard size={16}/>, label: 'MP / QR' },
                     { id: 'TRANSFERENCIA', icon: <FileText size={16}/>, label: 'Transfer' }
                   ].map(m => (
                     <button
                       key={m.id}
                       className={cn(
                         "flex-1 h-14 rounded-xl flex flex-col items-center justify-center border-2 transition-all gap-1",
                         paymentMethod === m.id ? "bg-brand-blue border-brand-blue text-white shadow-md scale-[1.02]" : "bg-white border-transparent text-slate-400 hover:border-slate-200"
                       )}
                       onClick={() => setPaymentMethod(m.id)}
                     >
                        {m.icon}
                        <span className="text-[8px] font-black uppercase tracking-tighter">{m.label}</span>
                     </button>
                   ))}
                 </div>
               ) : (
                 <div className="space-y-3">
                    <div className="relative">
                       <Banknote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                         type="number"
                         className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand-blue text-emerald-600"
                         placeholder="Efectivo..."
                         value={cashAmount || ''}
                         onChange={(e) => setCashAmount(Number(e.target.value))}
                       />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">EFECTIVO</span>
                    </div>
                    <div className="relative">
                       <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                         type="number"
                         className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand-blue text-brand-blue"
                         placeholder="Mercado Pago / Transf..."
                         value={systemAmount || ''}
                         onChange={(e) => setSystemAmount(Number(e.target.value))}
                       />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">SISTEMA</span>
                    </div>
                    
                    <div className="px-2 flex justify-between items-center text-[10px] font-bold">
                       <span className={cn(
                         total - (cashAmount + systemAmount) === 0 ? "text-emerald-500" : "text-rose-500"
                       )}>
                          {total - (cashAmount + systemAmount) === 0 ? '✓ TOTAL CUBIERTO' : `FALTAN: $${(total - (cashAmount + systemAmount)).toLocaleString()}`}
                       </span>
                    </div>
                 </div>
               )}
            </div>
          </div>
          
          <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 space-y-2 mt-4">
              <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <FileText size={12} /> CUIT Emisor (AFIP)
              </label>
              <Input 
                placeholder="30716493365"
                className="h-9 text-sm font-black bg-white border-slate-300"
                value={cuitEmisor}
                onChange={(e) => setCuitEmisor(e.target.value)}
              />
          </div>
          
          <Button 
             className="w-full h-14 text-lg font-black tracking-tight mt-6"
             onClick={() => handleFinalize()}
             disabled={cart.length === 0 || loading}
          >
            {loading ? 'Procesando...' : 'FINALIZAR VENTA'}
          </Button>
        </Card>
      </div>

      {/* Success Modal Overlay */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-blue/40 backdrop-blur-sm"
          >
            <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-6"
            >
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={64} />
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900">Operación Exitosa</h2>
                <p className="text-slate-500 mt-2">La venta ha sido registrada y el stock actualizado.</p>
              </div>
               <div className="flex flex-col gap-2 w-full">
                 <div className="flex gap-3">
                   <Button onClick={() => setIsSuccess(false)} variant="outline" className="flex-1">Nueva Venta</Button>
                   <Button onClick={handlePrintTicket} className="flex-1 bg-slate-900">
                      <FileText size={18} /> Imprimir
                   </Button>
                 </div>
                 {selectedCustomer?.phone && (
                   <Button onClick={handleWhatsAppShare} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black">
                     <MessageCircle size={18} /> Enviar por WhatsApp
                   </Button>
                 )}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
