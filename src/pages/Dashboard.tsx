import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';


import { supabase } from '../lib/supabase';
import { Card, Badge, Button, cn } from '../components/ui';

import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Wallet, 
  Truck, 
  AlertTriangle,
  Calendar,
  ChevronRight,
  ShoppingCart
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState<{name: string, total: number}[]>([]);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCost: 0,
    activeDebt: 0,
    pendingDeliveries: 0,
    lowStock: 0,
    weekSales: 0,
    monthSales: 0,
    yearSales: 0
  });
  const [topProducts, setTopProducts] = useState<{name: string, quantity: number, total: number}[]>([]);
  const [dailyGoal] = useState(500000); // Meta diaria de ejemplo

  useEffect(() => {
    fetchStats();
    fetchSalesHistory();
  }, []);

  const fetchSalesHistory = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Fetch sales and items with products join for cost
    const { data: history } = await supabase
      .from('sales')
      .select('created_at, total, id, sale_items(quantity, products(cost))')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (history) {
      const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
      const last7Days = Array.from({length: 7}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return { 
          name: days[d.getDay()], 
          date: d.toISOString().split('T')[0],
          total: 0,
          utility: 0
        };
      });

      history.forEach((sale: any) => {
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
        const dayObj = last7Days.find(d => d.date === saleDate);
        if (dayObj) {
          dayObj.total += sale.total;
          // Calculate cost of items in this sale
          const cost = sale.sale_items.reduce((acc: number, item: any) => acc + (item.quantity * (item.products?.cost || 0)), 0);
          dayObj.utility += (sale.total - cost);
        }
      });

      setSalesData(last7Days);
    }
  };

  const fetchStats = async () => {
    // Today's Sales & Cost
    const today = new Date().toISOString().split('T')[0];
    const { data: sales } = await supabase
      .from('sales')
      .select('total, sale_items(quantity, products(cost))')
      .gte('created_at', today);
    
    let todayTotal = 0;
    let todayCost = 0;

    sales?.forEach((sale: any) => {
      todayTotal += sale.total;
      const cost = sale.sale_items.reduce((acc: number, item: any) => acc + (item.quantity * (item.products?.cost || 0)), 0);
      todayCost += cost;
    });

    // CC Debt
    const { data: ledger } = await supabase.from('customer_ledger').select('amount, type');
    const totalDebt = (ledger || []).reduce((acc, curr) => curr.type === 'DEBITO' ? acc + curr.amount : acc - curr.amount, 0);

    // Pending Deliveries
    const { count: pendingD } = await supabase.from('sales').select('*', { count: 'exact', head: true }).eq('delivery_status', 'PENDIENTE');

    // Low Stock
    const { data: inventory } = await supabase.from('inventory').select('stock_current, stock_min');
    const lowCount = (inventory || []).filter(i => i.stock_current <= i.stock_min).length;

    // Period Stats
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const { data: weekS } = await supabase.from('sales').select('total').gte('created_at', startOfWeek);
    const { data: monthS } = await supabase.from('sales').select('total').gte('created_at', startOfMonth);
    const { data: yearS } = await supabase.from('sales').select('total').gte('created_at', startOfYear);

    // Top Products
    const { data: topData } = await supabase
      .from('sale_items')
      .select('quantity, subtotal, products(name)')
      .limit(100);
    
    const aggregated = topData?.reduce((acc: any, item: any) => {
      const name = item.products?.name || 'Desconocido';
      if (!acc[name]) acc[name] = { name, quantity: 0, total: 0 };
      acc[name].quantity += item.quantity;
      acc[name].total += item.subtotal;
      return acc;
    }, {});
    
    const topList = Object.values(aggregated || {})
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 5) as any[];

    setTopProducts(topList);

    setStats({
      todaySales: todayTotal,
      todayCost: todayCost,
      activeDebt: totalDebt,
      pendingDeliveries: pendingD || 0,
      lowStock: lowCount,
      weekSales: (weekS || []).reduce((acc, s) => acc + s.total, 0),
      monthSales: (monthS || []).reduce((acc, s) => acc + s.total, 0),
      yearSales: (yearS || []).reduce((acc, s) => acc + s.total, 0)
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tight">¡Buen día, Líder!</h1>
           <p className="text-slate-500 font-medium mt-1 uppercase text-xs tracking-widest">Estado general del corralón • Hoy {new Date().toLocaleDateString('es-AR')}</p>
        </div>
        <Button variant="secondary" className="bg-brand-blue shadow-premium" onClick={() => navigate('/entregas')}>
          <Calendar size={18} /> Ver Calendario de Entregas
        </Button>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
            <TrendingUp size={64} className="text-emerald-600" />
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Ventas del Día</p>
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-3xl font-black text-slate-900">${stats.todaySales.toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold">
               <ArrowUpRight size={14} /> +14%
            </div>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden group bg-brand-blue/5 border-emerald-100">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform text-emerald-600">
             <TrendingUp size={64} />
          </div>
          <p className="text-emerald-700 font-bold text-xs uppercase tracking-widest">Utilidad Bruta Hoy</p>
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-3xl font-black text-emerald-700">${(stats.todaySales - stats.todayCost).toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black uppercase">
               MARGEN: {stats.todaySales > 0 ? (((stats.todaySales - stats.todayCost) / stats.todaySales) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
            <Truck size={64} className="text-brand-red" />
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Pendientes Entrega</p>
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-3xl font-black text-slate-900">{stats.pendingDeliveries}</h3>
            <div className="flex items-center gap-1 text-brand-red bg-red-50 px-2 py-1 rounded-lg text-xs font-bold">
               <ArrowUpRight size={14} /> 2 hoy
            </div>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden group border-orange-100 bg-orange-50/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
            <AlertTriangle size={64} className="text-orange-600" />
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Stock Crítico</p>
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-3xl font-black text-orange-600">{stats.lowStock}</h3>
            <Badge variant="orange">Revisar</Badge>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="p-6 bg-slate-900 text-white border-none">
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Ventas de la Semana</p>
            <h3 className="text-2xl font-black mt-1">${stats.weekSales.toLocaleString()}</h3>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
               <div className="bg-brand-blue h-full" style={{width: '65%'}} />
            </div>
         </Card>
         <Card className="p-6 bg-slate-900 text-white border-none">
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Ventas del Mes</p>
            <h3 className="text-2xl font-black mt-1">${stats.monthSales.toLocaleString()}</h3>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
               <div className="bg-emerald-400 h-full" style={{width: '45%'}} />
            </div>
         </Card>
         <Card className="p-6 bg-slate-900 text-white border-none">
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Ventas del Año</p>
            <h3 className="text-2xl font-black mt-1">${stats.yearSales.toLocaleString()}</h3>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
               <div className="bg-brand-red h-full" style={{width: '80%'}} />
            </div>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-8">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Estado de Objetivos</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">¿Cómo vamos hoy comparado con la meta?</p>
              </div>
              <div className={cn(
                "px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all",
                stats.todaySales >= dailyGoal 
                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : stats.todaySales >= (dailyGoal * 0.7)
                    ? "bg-amber-500 text-white shadow-amber-500/20"
                    : "bg-brand-red text-white shadow-red-500/20"
              )}>
                {stats.todaySales >= dailyGoal ? '¡Excelente!' : stats.todaySales >= (dailyGoal * 0.7) ? 'Cerca de la Meta' : 'Bajo Rendimiento'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-[32px] border border-slate-100 relative overflow-hidden group">
                  <div className="relative z-10 text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Progreso del Día</p>
                     <p className="text-5xl font-black text-slate-900 leading-none">
                        {Math.min(100, Math.round((stats.todaySales / dailyGoal) * 100))}%
                     </p>
                     <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase">Meta: ${dailyGoal.toLocaleString()}</p>
                  </div>
                  {/* Progress Ring Background */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                     <TrendingUp size={200} />
                  </div>
               </div>

               <div className="space-y-6">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Histórico 7 Días</p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={salesData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '700'}} />
                          <Tooltip 
                            cursor={{fill: '#f1f5f9'}}
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}}
                          />
                          <Bar dataKey="total" fill="#1D1D4B" radius={[6, 6, 0, 0]} barSize={20} />
                       </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
         </Card>

        <Card className="p-8 space-y-6">
           <h3 className="text-xl font-black text-slate-800">Accesos Rápidos</h3>
           <div className="space-y-3">
             <Button 
               onClick={() => navigate('/pos')}
               className="w-full h-16 bg-slate-900 hover:bg-black rounded-2xl flex items-center justify-start px-6 gap-4"
             >
               <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                 <ShoppingCart size={20} />
               </div>
               <div className="text-left">
                 <p className="font-black text-white leading-none">Nueva Venta</p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Lanzar POS rápido</p>
               </div>
               <ChevronRight size={18} className="ml-auto text-slate-600" />
             </Button>


             <Button 
               onClick={() => navigate('/entregas')}
               variant="outline" className="w-full h-16 rounded-2xl flex items-center justify-start px-6 gap-4 border-slate-100 bg-slate-50/50"
             >
               <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-brand-blue">
                 <Truck size={20} />
               </div>
               <div className="text-left">
                 <p className="font-black text-slate-800 leading-none">Hoja de Ruta</p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">4 Entregas pendientes</p>
               </div>
               <ChevronRight size={18} className="ml-auto text-slate-300" />
             </Button>


             <Button 
               onClick={() => navigate('/productos')}
               variant="outline" className="w-full h-16 rounded-2xl flex items-center justify-start px-6 gap-4 border-slate-100 bg-slate-50/50"
             >
               <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center text-brand-red">
                 <ArrowUpRight size={20} />
               </div>
               <div className="text-left">
                 <p className="font-black text-slate-800 leading-none">Carga Express</p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Reponer stock rápido</p>
               </div>
               <ChevronRight size={18} className="ml-auto text-slate-300" />
             </Button>

           </div>

           <div className="pt-6 border-t border-slate-100">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Productos más vendidos</p>
             <div className="space-y-4">
               {topProducts.length === 0 ? (
                 <p className="text-xs text-slate-300 italic">No hay datos de ventas aún.</p>
               ) : (
                 topProducts.map((p, i) => (
                   <div key={i} className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">
                       {i + 1}
                     </div>
                     <div className="flex-1">
                       <p className="text-sm text-slate-700 font-bold truncate max-w-[150px]">{p.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{p.quantity} unidades</p>
                     </div>
                     <span className="text-xs font-black text-brand-blue">${p.total.toLocaleString()}</span>
                   </div>
                 ))
               )}
             </div>
           </div>

           <div className="pt-6 border-t border-slate-100">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actividad Reciente</p>
             <div className="space-y-4">
               {[1,2,3].map(i => (
                 <div key={i} className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500" />
                   <p className="text-sm text-slate-600 font-medium">Venta #V-7261 completada</p>
                   <span className="text-[10px] font-bold text-slate-300 ml-auto">14:02</span>
                 </div>
               ))}
             </div>
           </div>
        </Card>
      </div>
    </div>
  );
};
