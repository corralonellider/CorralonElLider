import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Truck, 
  Wallet, 
  BarChart3, 
  Menu, 
  X, 
  ChevronRight, 
  Store,
  LogOut,
  Bell,
  Search,
  Globe
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { PublicShowcase } from './pages/PublicShowcase';
import { Cash } from './pages/Cash';
import { Deliveries } from './pages/Deliveries';
import { cn, Button } from './components/ui';

// --- LAYOUT COMPONENTS ---

const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Panel General', path: '/admin' },
    { icon: ShoppingCart, label: 'Punto de Venta', path: '/admin/pos' },
    { icon: Package, label: 'Productos y Stock', path: '/admin/productos' },
    { icon: Users, label: 'Clientes y Cuentas', path: '/admin/clientes' },
    { icon: Globe, label: 'Vidriera Web', path: '/' },
    { icon: Truck, label: 'Entregas', path: '/admin/entregas' },
    { icon: Wallet, label: 'Caja Diaria', path: '/admin/caja' },
    { icon: BarChart3, label: 'Reportes', path: '/admin/reportes' },
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Mobile Drawer */}
      <aside className={cn(`
        fixed top-0 left-0 bottom-0 w-72 bg-brand-blue text-slate-300 z-50 transition-all duration-300 transform shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `)}>
        <div className="p-8 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-blue shadow-lg">
              <Store size={22} />
            </div>
            <div>
              <h2 className="font-black text-white text-lg leading-none tracking-tight uppercase">El Líder</h2>
              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1">Manejo Operativo</p>
            </div>
          </div>
          <button className="lg:hidden p-2 text-white/40 hover:text-white" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="p-6 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          {menuItems.map(item => {
            const isActive = location.pathname === item.path;
            
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={cn(`
                  flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group
                  ${isActive 
                    ? 'bg-brand-red text-white shadow-xl shadow-red-500/20 active:scale-95' 
                    : 'hover:bg-white/5 hover:text-white'}
                `)}
              >
                <item.icon size={22} className={cn(isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                <span className="font-bold tracking-tight">{item.label}</span>
                {isActive && <ChevronRight size={16} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red to-brand-blue flex items-center justify-center text-white font-black shadow-lg">

                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-black text-white truncate leading-none">{profile?.full_name || 'Operador'}</p>
                <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">{profile?.role || 'Personal'}</p>
              </div>
              <button 
                onClick={signOut} 
                className="text-white/20 hover:text-brand-red transition-all p-2 rounded-lg hover:bg-white/5"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const Header = ({ onMenuClick, isSessionOpen }: { onMenuClick: () => void, isSessionOpen: boolean }) => {

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 h-20 flex items-center justify-between px-6 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4 md:gap-6">
        <button 
          className="p-2 -ml-2 text-slate-400 hover:text-brand-blue lg:hidden"
          onClick={onMenuClick}
        >
          <Menu size={24} />
        </button>
        
        <div className="hidden md:flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              placeholder="Buscar venta, cliente o pedido..." 
              className="pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium w-80 focus:ring-2 focus:ring-brand-blue/10 outline-none transition-all placeholder:text-slate-300" 
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className={cn(
          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border",
          isSessionOpen 
            ? "bg-emerald-50 text-emerald-700 border-emerald-100/50" 
            : "bg-rose-50 text-rose-700 border-rose-100/50"
        )}>
          <div className={cn("w-2 h-2 rounded-full", isSessionOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
          {isSessionOpen ? 'Caja Abierta' : 'Caja Cerrada'}
        </div>

        <button className="p-2.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-xl transition-all relative">
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand-red rounded-full border-2 border-white" />
        </button>
      </div>
    </header>
  );
};

// --- ROUTES ---

const AppContent = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchSessionStatus = async () => {
      const { data } = await supabase
        .from('cash_sessions')
        .select('status')
        .eq('status', 'ABIERTA')
        .limit(1);
      
      setIsSessionOpen(data && data.length > 0);
    };
    fetchSessionStatus();

    // Channel for real-time updates (Optional but good)
    const channel = supabase.channel('cash_sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions' }, () => {
        fetchSessionStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);


  if (location.pathname === '/' || (!location.pathname.startsWith('/admin') && location.pathname !== '/catalogo')) {
    return (
      <Routes>
        <Route path="/" element={<PublicShowcase />} />
        <Route path="/catalogo" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <Header onMenuClick={() => setIsSidebarOpen(true)} isSessionOpen={isSessionOpen} />
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-h-[calc(100vh-80px)] overflow-y-auto">
          <Routes>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/pos" element={<POS />} />
            <Route path="/admin/productos" element={<Products />} />
            <Route path="/admin/clientes" element={<Customers />} />
            <Route path="/admin/entregas" element={<Deliveries />} />
            <Route path="/admin/caja" element={<Cash />} />
            <Route path="/admin/reportes" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

