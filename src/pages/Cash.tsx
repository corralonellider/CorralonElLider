import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Input } from '../components/ui';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  Lock,
  Unlock,
  History,
  FileText,
  X,
  Search,
  AlertTriangle
} from 'lucide-react';

import { AnimatePresence, motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { cn } from '../components/ui';

interface CashSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: 'ABIERTA' | 'CERRADA';
}

interface CashMovement {
  id: string;
  amount: number;
  type: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA';
  description: string;
  created_at: string;
  movement_type: 'ingreso' | 'egreso';
  sale_id?: string;
}

export const Cash = () => {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [newMovement, setNewMovement] = useState({ amount: 0, description: '', method: 'EFECTIVO' });
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [countedAmount, setCountedAmount] = useState<number>(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedSaleItems, setSelectedSaleItems] = useState<any[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setCurrentSession(data);
      if (data.status === 'ABIERTA') {
        fetchMovements(data.id);
      }
    }
    setLoading(false);
  };

  const fetchMovements = async (sessionId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (data) {
      setMovements(data.map(m => ({
        id: m.id,
        amount: m.amount,
        type: m.method,
        description: m.reference_code || (m.method === 'EFECTIVO' ? 'Venta de Mostrador' : 'Cobro Sistema'),
        created_at: m.created_at,
        movement_type: m.amount >= 0 ? 'ingreso' : 'egreso',
        sale_id: m.sale_id
      })));
    }
  };

  const handleViewSaleDetail = async (saleId: string) => {
    const { data: items } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);
    
    if (items && items.length > 0) {
      const productIds = items.map((i: any) => i.product_id);
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, unit')
        .in('id', productIds);

      const enrichedItems = items.map((item: any) => ({
        ...item,
        product: productsData?.find((p: any) => p.id === item.product_id) || { name: 'Producto Desconocido', unit: 'U' },
        total_price: item.total_price || item.subtotal || (item.unit_price * item.quantity)
      }));

      setSelectedSaleItems(enrichedItems);
      setIsDetailModalOpen(true);
    } else {
      alert("No se encontraron productos para esta transacción.");
    }
  };


  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;

    const { error } = await supabase.from('payments').insert([{
      session_id: currentSession.id,
      amount: movementType === 'ingreso' ? Math.abs(newMovement.amount) : -Math.abs(newMovement.amount),
      method: newMovement.method,
      reference_code: newMovement.description
    }]);


    if (!error) {
      if (currentSession) fetchMovements(currentSession.id);
      setIsMovementModalOpen(false);
      setNewMovement({ amount: 0, description: '', method: 'EFECTIVO' });
    }
  };

  const handleProcessRefund = async () => {
    if (!currentSession || selectedSaleItems.length === 0) return;
    const saleId = selectedSaleItems[0].sale_id;
    if (!saleId) return;

    if (!window.confirm('¿Estás seguro de anular esta venta? Esto registrará un egreso de dinero y devolverá los productos al stock. Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    const totalRefund = selectedSaleItems.reduce((acc, i) => acc + Number(i.total_price), 0);

    // 1. Return stock -> inventory_movements & inventory
    const invMovements = selectedSaleItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      type: 'AJUSTE',
      description: `Anulación Venta #${saleId.slice(0,8)}`,
      reference_id: saleId
    }));
    await supabase.from('inventory_movements').insert(invMovements);

    for (const item of selectedSaleItems) {
      const { data: prod } = await supabase.from('inventory').select('stock_current').eq('product_id', item.product_id).single();
      if (prod) {
        await supabase.from('inventory').update({ stock_current: prod.stock_current + item.quantity }).eq('product_id', item.product_id);
      }
    }

    // 2. Refund money -> payments
    await supabase.from('payments').insert([{
      session_id: currentSession.id,
      sale_id: saleId,
      amount: -totalRefund,
      method: 'EFECTIVO',
      reference_code: `Anulación Venta #${saleId.slice(0,8)}`
    }]);

    setIsDetailModalOpen(false);
    fetchMovements(currentSession.id);
    setLoading(false);
    alert('✅ Devolución procesada correctamente (dinero restado y stock restaurado).');
  };

  const handleOpenSession = async () => {
    const amount = prompt('Ingrese el fondo inicial para abrir la caja:');
    if (amount === null) return;

    const { data, error } = await supabase.from('cash_sessions').insert([{
      opening_balance: Number(amount),
      status: 'ABIERTA'
    }]).select().single();

    if (error) {
      console.error('Error abriendo caja:', error);
      alert('Error al abrir caja: ' + error.message + '\n\nVerifica que tu usuario tenga un perfil creado.');
    } else if (data) {
      fetchSession();
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession) return;

    const { error } = await supabase.from('cash_sessions').update({
      closed_at: new Date().toISOString(),
      closing_balance: countedAmount,
      status: 'CERRADA'
    }).eq('id', currentSession.id);

    if (error) {
      alert('Error al cerrar caja: ' + error.message);
    } else {
      setIsClosingModalOpen(false);
      setShowResult(false);
      fetchSession();
    }
  };


  const currentBalance = currentSession
    ? currentSession.opening_balance + movements.reduce((acc, m) => acc + m.amount, 0)
    : 0;

  const filteredMovements = movements.filter(m => 
    (m.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (m.sale_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    m.amount.toString().includes(searchQuery)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Wallet size={32} className="text-brand-blue" />
            Caja Diaria
          </h1>
          <p className="text-slate-500 font-medium">Control de ingresos, egresos y arqueo de caja.</p>
        </div>

        {currentSession?.status === 'ABIERTA' ? (
          <Button variant="danger" className="h-12 px-8" onClick={() => setIsClosingModalOpen(true)}>
            <Lock size={18} /> CERRAR CAJA
          </Button>
        ) : (
          <Button className="h-12 px-8" onClick={handleOpenSession}>
            <Unlock size={18} /> ABRIR CAJA
          </Button>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className={cn(
            "p-8 border-none shadow-premium relative overflow-hidden transition-all",
            currentSession?.status === 'ABIERTA' ? "bg-brand-blue text-white" : "bg-slate-200 text-slate-500"
          )}>
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Balance en Caja (Efectivo)</p>
                <Badge variant={currentSession?.status === 'ABIERTA' ? 'green' : 'slate'}>
                  {currentSession?.status || 'SIN SESION'}
                </Badge>
              </div>
              <h2 className="text-5xl font-black tracking-tighter">${currentBalance.toLocaleString()}</h2>
              <div className="pt-6 border-t border-white/10 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="opacity-60">FONDO INICIAL</span>
                  <span>${(currentSession?.opening_balance || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-400">
                  <span>TOTAL INGRESOS</span>
                  <span>+${movements.filter(m => m.movement_type === 'ingreso').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-1 bg-white border-slate-100 shadow-sm text-emerald-600 hover:text-emerald-700"
              disabled={currentSession?.status !== 'ABIERTA'}
              onClick={() => {
                setMovementType('ingreso');
                setIsMovementModalOpen(true);
              }}
            >
              <Plus size={24} />
              <span className="text-[10px] font-black uppercase">Ingreso</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-1 bg-white border-slate-100 shadow-sm text-rose-600 hover:text-rose-700"
              disabled={currentSession?.status !== 'ABIERTA'}
              onClick={() => {
                setMovementType('egreso');
                setIsMovementModalOpen(true);
              }}
            >
              <Minus size={24} />
              <span className="text-[10px] font-black uppercase">Egreso</span>
            </Button>
          </div>

        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0 border-none shadow-premium bg-white overflow-hidden min-h-[500px]">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <History size={20} className="text-slate-400" />
                Movimientos de la Sesión
              </h3>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <Input 
                     placeholder="Buscar ticket, ID o $..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="pl-9 h-9 text-xs bg-slate-50 border-none"
                   />
                </div>
                <Button variant="ghost" className="h-9 px-3 text-xs shrink-0 bg-slate-50 hover:bg-slate-100">
                  <FileText size={16} className="mr-2" /> PDF
                </Button>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {filteredMovements.length === 0 ? (
                <div className="p-20 text-center space-y-4 text-slate-300">
                  <History size={48} strokeWidth={1} className="mx-auto" />
                  <p className="font-medium italic">No se registran movimientos en esta sesión.</p>
                </div>
              ) : (
                filteredMovements.map(m => (
                  <div key={m.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
                        m.movement_type === 'ingreso' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {m.movement_type === 'ingreso' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{m.description}</p>
                          {m.sale_id && (
                            <Badge 
                              variant="blue" 
                              className="text-[9px] h-4 cursor-pointer hover:bg-blue-100 transition-colors"
                              onClick={() => handleViewSaleDetail(m.sale_id!)}
                            >
                              REF: #{m.sale_id.slice(0,8)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.type}</span>
                          <span className="text-[10px] text-slate-300">•</span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "text-lg font-black",
                          m.movement_type === 'ingreso' ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {m.movement_type === 'ingreso' ? '+' : '-'} ${Math.abs(m.amount).toLocaleString()}
                        </p>
                      </div>
                      {m.sale_id && (
                        <Button variant="ghost" className="p-2 h-9 w-9 text-slate-300 hover:text-brand-blue" onClick={() => handleViewSaleDetail(m.sale_id!)}>
                          <History size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <Card className="w-full max-w-lg p-0 overflow-hidden relative">
                <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                   <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                     📦 Detalle de la Operación
                   </h3>
                   <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                     <X size={20} />
                   </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                   {selectedSaleItems.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase line-clamp-1">{item.product?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {item.quantity} {item.product?.unit} x ${Number(item.unit_price).toLocaleString()}
                          </p>
                        </div>
                        <p className="font-black text-slate-900">${Number(item.total_price).toLocaleString()}</p>
                     </div>
                   ))}
                </div>
                
                <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <div>
                     <p className="text-[10px] font-black uppercase opacity-60">Total Operación</p>
                     <p className="text-2xl font-black tracking-tighter">
                       ${selectedSaleItems.reduce((acc, i) => acc + Number(i.total_price), 0).toLocaleString()}
                     </p>
                   </div>
                   <div className="flex gap-2 w-full sm:w-auto">
                     <Button onClick={handleProcessRefund} className="flex-1 sm:flex-none h-10 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs">
                       <AlertTriangle size={14} className="mr-2" />
                       Anular / Devolver
                     </Button>
                     <Button onClick={() => setIsDetailModalOpen(false)} className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs">
                       Cerrar
                     </Button>
                   </div>
                </div>
             </Card>
          </div>
        )}
      </AnimatePresence>

      {/* Movement Modal */}
      <AnimatePresence>
        {isMovementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-md p-8 relative">
              <button
                onClick={() => setIsMovementModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  movementType === 'ingreso' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                )}>
                  {movementType === 'ingreso' ? <Plus size={24} /> : <Minus size={24} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Registrar {movementType}
                </h3>
              </div>

              <form onSubmit={handleCreateMovement} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monto ($)</label>
                  <Input
                    required
                    type="number"
                    value={newMovement.amount}
                    onChange={e => setNewMovement({ ...newMovement, amount: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descripción / Concepto</label>
                  <Input
                    required
                    value={newMovement.description}
                    onChange={e => setNewMovement({ ...newMovement, description: e.target.value })}
                    placeholder="Ej: Pago de viáticos o Venta manual"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Método</label>
                  <select
                    className="w-full input-standard text-sm"
                    value={newMovement.method}
                    onChange={e => setNewMovement({ ...newMovement, method: e.target.value })}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  className={cn(
                    "w-full h-12 mt-4 font-black",
                    movementType === 'ingreso' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  )}
                >
                  CONFIRMAR {movementType.toUpperCase()}
                </Button>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>

      {/* Blind Closure Modal */}
      <AnimatePresence>
        {isClosingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <Card className="w-full max-w-md p-10 relative border-none shadow-2xl overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-brand-red to-rose-500" />

              <div className="text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-rose-50 text-brand-red rounded-3xl flex items-center justify-center shadow-inner">
                  <Lock size={32} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 uppercase">Arqueo de Caja</h2>
                  <p className="text-sm text-slate-400 font-medium px-4">Por seguridad, declará el monto físico total de efectivo antes de cerrar.</p>
                </div>

                {!showResult ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Efectivo contado hoy</label>
                      <Input
                        type="number"
                        className="text-3xl h-20 text-center font-black"
                        value={countedAmount || ''}
                        onChange={(e) => setCountedAmount(Number(e.target.value))}
                        placeholder="$ 0.00"
                      />
                    </div>
                    <Button
                      className="w-full h-14 bg-slate-900 text-white font-black rounded-2xl"
                      onClick={() => setShowResult(true)}
                    >
                      VERIFICAR DIFERENCIA
                    </Button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 pt-4 border-t border-slate-50"
                  >
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-[9px] font-black uppercase text-slate-400">Sistema dice:</p>
                        <p className="text-lg font-black text-slate-800">${currentBalance.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-brand-blue/5 rounded-xl">
                        <p className="text-[9px] font-black uppercase text-brand-blue">Hoy contaste:</p>
                        <p className="text-lg font-black text-brand-blue">${countedAmount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className={cn(
                      "p-6 rounded-2xl flex flex-col items-center justify-center gap-1",
                      countedAmount === currentBalance ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                      <p className="text-xs font-black uppercase tracking-widest">Diferencia de Cierre</p>
                      <h4 className="text-4xl font-black tracking-tighter">
                        {countedAmount - currentBalance === 0 ? '$0' : (countedAmount - currentBalance > 0 ? '+' : '-') + '$' + Math.abs(countedAmount - currentBalance).toLocaleString()}
                      </h4>
                      <p className="text-[10px] font-bold uppercase mt-1">
                        {countedAmount === currentBalance ? '¡Caja perfecta!' : (countedAmount > currentBalance ? 'Sobrante detectado' : 'Faltante detectado')}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        className="flex-1 h-12"
                        onClick={() => setShowResult(false)}
                      >
                        Volver a contar
                      </Button>
                      <Button
                        className="flex-[1.5] h-12 bg-emerald-600 text-white"
                        onClick={handleCloseSession}
                      >
                        CONFIRMAR CIERRE
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </Card>
          </div>
        )}
      </AnimatePresence>
    </div>

  );
};
