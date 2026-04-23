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
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
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

    // Recent Activity
    const { data: recent } = await supabase
      .from('sales')
      .select('id, friendly_id, created_at, total')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentActivity(recent || []);

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Resumen de Actividad</h1>
           <p className="text-slate-500 font-medium text-sm mt-1">Estado general del corralón al {new Date().toLocaleDateString('es-AR')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200" onClick={() => navigate('/admin/productos')}>
            <ArrowUpRight size={16} className="mr-2" /> Ingresar Stock
          </Button>
          <Button className="bg-brand-blue" onClick={() => navigate('/admin/pos')}>
            <ShoppingCart size={16} className="mr-2" /> Nueva Venta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 font-medium text-sm">Ventas de Hoy</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">${stats.todaySales.toLocaleString()}</h3>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
              <TrendingUp size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 font-medium text-sm">Utilidad Bruta Hoy</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">${(stats.todaySales - stats.todayCost).toLocaleString()}</h3>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Wallet size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 font-medium text-sm">Entregas Pendientes</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.pendingDeliveries}</h3>
            </div>
            <div className="p-2 bg-brand-blue/10 rounded-lg text-brand-blue">
              <Truck size={20} />
            </div>
          </div>
          {stats.pendingDeliveries > 0 && (
            <button onClick={() => navigate('/admin/entregas')} className="text-xs text-brand-blue font-medium mt-3 hover:underline">
              Ver hoja de ruta →
            </button>
          )}
        </Card>

        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 font-medium text-sm">Alertas de Stock</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.lowStock}</h3>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <AlertTriangle size={20} />
            </div>
          </div>
          {stats.lowStock > 0 && (
             <button onClick={() => navigate('/admin/productos')} className="text-xs text-orange-600 font-medium mt-3 hover:underline">
               Revisar inventario →
             </button>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-6">Histórico de Ventas (Últimos 7 Días)</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'}}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
               </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Acumulado Semanal</p>
              <p className="text-lg font-bold text-slate-800">${stats.weekSales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Acumulado Mensual</p>
              <p className="text-lg font-bold text-slate-800">${stats.monthSales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Acumulado Anual</p>
              <p className="text-lg font-bold text-slate-800">${stats.yearSales.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-base font-bold text-slate-800">Últimas Operaciones</h3>
               <button onClick={() => navigate('/admin/reportes')} className="text-xs text-brand-blue hover:underline font-medium">Ver todo</button>
             </div>
             
             <div className="space-y-0">
               {recentActivity.length === 0 ? (
                 <p className="text-sm text-slate-500 py-4 text-center">No hay actividad reciente.</p>
               ) : (
                 recentActivity.map((sale: any, idx: number) => (
                   <div key={sale.id} className={cn(
                     "flex items-center justify-between py-3",
                     idx !== recentActivity.length - 1 && "border-b border-slate-100"
                   )}>
                     <div>
                       <p className="text-sm font-semibold text-slate-800">Venta #{sale.friendly_id}</p>
                       <p className="text-xs text-slate-500 mt-0.5">
                         {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                       </p>
                     </div>
                     <span className="text-sm font-bold text-slate-800">${sale.total.toLocaleString()}</span>
                   </div>
                 ))
               )}
             </div>
          </Card>

          <Card className="p-6 border-slate-200 shadow-sm">
             <h3 className="text-base font-bold text-slate-800 mb-4">Productos más vendidos</h3>
             <div className="space-y-4">
               {topProducts.length === 0 ? (
                 <p className="text-sm text-slate-500 text-center py-2">Sin datos suficientes.</p>
               ) : (
                 topProducts.map((p, i) => (
                   <div key={i} className="flex items-center justify-between">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <span className="text-xs font-bold text-slate-400 w-4">{i + 1}.</span>
                       <p className="text-sm text-slate-700 font-medium truncate">{p.name}</p>
                     </div>
                     <span className="text-xs font-semibold text-slate-500 whitespace-nowrap ml-2">{p.quantity} ud.</span>
                   </div>
                 ))
               )}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
