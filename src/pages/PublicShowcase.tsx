import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge } from '../components/ui';
import {
  Search,
  MessageCircle,
  Truck,
  Wallet,
  Package,
  Phone,
  Instagram,
  MapPin,
  Store,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Trash2,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../components/ui';

interface Product {
  id: string;
  name: string;
  description: string;
  price_base: number;
  category: { name: string } | null;
  image_url: string | null;
}

export const PublicShowcase = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    fetchPublicProducts();
  }, [category]);

  const fetchPublicProducts = async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, category:categories(name)')
      .eq('visible_web', true)
      .eq('active', true);

    if (category) {
      query = query.eq('category_id', category);
    }

    const { data } = await query;
    if (data) setProducts(data);
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price_base * item.qty), 0);

  const handleRequestBudget = () => {
    const itemsText = cart.map(item =>
      `✅ *${item.qty}* x ${item.product.name} _($${(item.product.price_base * item.qty).toLocaleString()})_`
    ).join('%0A');

    const text = `*SOLICITUD DE PRESUPUESTO - EL LÍDER*%0A%0AHola! 👋 Me gustaría solicitar un presupuesto por el siguiente listado de materiales:%0A%0A${itemsText}%0A%0A💰 *TOTAL ESTIMADO: $${total.toLocaleString()}*%0A%0A_Quedo a la espera de su confirmación para coordinar el envío. Gracias!_`;
    window.open(`https://wa.me/5491164695865?text=${text}`, '_blank');
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-brand-red selection:text-white">
      {/* Dynamic Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Corralón El Líder" className="h-14 object-contain mix-blend-multiply" />
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-8">
              {['Inicio', 'Catálogo', 'Nosotros', 'Contacto'].map(item => (
                <a key={item} href="#" className="text-sm font-bold text-slate-500 hover:text-brand-red transition-colors">{item}</a>
              ))}
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 bg-slate-50 text-slate-900 rounded-xl hover:bg-slate-100 transition-all shadow-sm border border-slate-100"
            >
              <ShoppingCart size={22} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-red text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-lg">
                  {cart.length}
                </span>
              )}
            </button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 md:px-6"
              onClick={handleRequestBudget}
              disabled={cart.length === 0}
            >
              <MessageCircle size={18} /> <span className="hidden sm:inline">Enviar Lista</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 overflow-hidden bg-brand-blue">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="max-w-7xl mx-auto px-6 relative flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-3xl"
          >
            <Badge variant="green" className="bg-emerald-400/20 text-emerald-400 border border-emerald-400/20 px-4 py-1.5">
              Envíos propios en toda la zona
            </Badge>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[0.9]">
              Todo para tu obra en <span className="text-brand-red">un solo lugar.</span>
            </h2>
            <p className="text-slate-300 text-lg md:text-xl font-medium max-w-2xl mx-auto">
              Materiales gruesos, terminaciones, ferretería y más. Los mejores precios de barrio con stock permanente garantizado.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button className="h-14 px-10 text-lg font-black bg-brand-red shadow-2xl shadow-red-500/40">
                Ver Catálogo
              </Button>
              <Button
                variant="outline"
                className="h-14 px-10 text-lg font-black border-white/20 text-white hover:bg-white/5"
                onClick={() => window.open('https://maps.google.com/?q=Av.+Avellaneda+5770,+Virreyes,+San+Fernando,+Buenos+Aires', '_blank')}
              >
                Nuestra Ubicación
              </Button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Main Catalog Area */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 space-y-8">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Categorías</h3>
              <div className="flex flex-col gap-2">
                {['Todos', 'Gruesos', 'Áridos', 'Terminaciones', 'Pinturas', 'Sanitarios'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat === 'Todos' ? null : cat)}
                    className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-slate-50 font-bold text-slate-600 transition-all text-sm group"
                  >
                    {cat}
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
              <h4 className="font-black text-slate-900">¿No encontrás lo que buscas?</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">Trabajamos con pedidos personalizados para obras de gran escala. Consultanos por stock especial.</p>
              <Button variant="outline" className="w-full bg-white border-slate-200">
                Contactar Ventas
              </Button>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input
                  type="text"
                  placeholder="Buscá por nombre de producto..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-brand-blue/10 text-slate-700 font-bold transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{filteredProducts.length} Productos encontrados</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts.map(p => (
                <motion.div
                  layout
                  key={p.id}
                  className="group bg-white rounded-[2rem] border border-slate-100 p-2 shadow-sm hover:shadow-2xl transition-all"
                >
                  <div className="aspect-[4/3] rounded-[1.8rem] bg-slate-100 relative overflow-hidden flex items-center justify-center text-slate-300">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <Package size={64} strokeWidth={1} />
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <Badge variant="blue" className="text-[9px]">{p.category?.name || 'Varios'}</Badge>
                      <h3 className="text-xl font-bold text-slate-900 leading-tight group-hover:text-brand-red transition-colors">{p.name}</h3>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio Hoy</span>
                        <span className="text-2xl font-black text-brand-blue">${p.price_base.toLocaleString()}</span>
                      </div>
                      <Button
                        onClick={() => addToCart(p)}
                        className="h-12 px-6 bg-brand-red text-white flex gap-2 items-center rounded-2xl group/btn"
                      >
                        <Plus size={18} className="group-hover/btn:rotate-90 transition-transform" />
                        Sumar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {loading && <div className="p-20 text-center font-black text-slate-300 animate-pulse">CARGANDO CATÁLOGO...</div>}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-brand-blue text-white pt-24 pb-12 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
               <h1 className="text-3xl font-black tracking-tight text-white uppercase">El Líder<span className="text-brand-red">.</span></h1>
               <p className="text-[10px] font-bold text-brand-red tracking-[0.3em] uppercase">Materiales & Arquitectura</p>
            </div>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Servicio líder en materiales para la construcción. Abastecemos a vecinos, profesionales y grandes obras con la misma dedicación.
            </p>
            <div className="flex gap-4">
              {[Instagram, Phone].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-brand-red transition-all">
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-black uppercase tracking-widest text-xs mb-6 text-brand-red">Navegación</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              {['Home', 'Catálogo Completo', 'Promociones', 'Envíos'].map(i => (
                <li key={i}><a href="#" className="hover:text-white transition-colors">{i}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-black uppercase tracking-widest text-xs mb-6 text-brand-red">Contacto</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              <li className="flex items-start gap-3"><MapPin size={18} className="text-brand-red shrink-0" /> Av. Avellaneda 5770, CP 1646 Virreyes, San Fernando</li>
              <li className="flex items-center gap-3"><Phone size={18} className="text-brand-red shrink-0" /> 11 3348-3980 (Llamadas)</li>
              <li className="flex items-center gap-3"><MessageCircle size={18} className="text-brand-red shrink-0" /> +54 9 11 6469-5865 (WhatsApp)</li>
            </ul>
          </div>

          <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5">
            <h4 className="font-black uppercase tracking-widest text-xs mb-4">Horarios Operativos</h4>
            <div className="space-y-3">
              <div className="flex flex-col text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Lunes a Viernes</span>
                  <span className="font-bold">08-12 / 13-17hs</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Sábados</span>
                <span className="font-bold">08 - 13hs</span>
              </div>
              <p className="text-[10px] text-brand-red font-black uppercase mt-4">Domingos Cerrado</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">© 2024 Corralón El Líder • Desarrollado para el crecimiento PyME</p>
        </div>
      </footer>

      {/* Shopping Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-red/10 rounded-xl text-brand-red">
                    <ShoppingCart size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Tu Presupuesto</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                    <ShoppingCart size={64} className="text-slate-300" strokeWidth={1} />
                    <p className="text-slate-500 font-bold">Tu carrito está vacío</p>
                    <Button variant="outline" onClick={() => setIsCartOpen(false)}>Ver Catálogo</Button>
                  </div>
                ) : (
                  cart.map(item => (
                    <motion.div
                      layout
                      key={item.product.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 text-sm truncate uppercase tracking-tighter">{item.product.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">${item.product.price_base.toLocaleString()} c/u</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1.5 text-slate-300 hover:text-brand-red transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-9">
                          <button
                            onClick={() => updateQty(item.product.id, -1)}
                            className="px-3 hover:bg-slate-50 text-slate-400 border-r border-slate-100"
                          ><Minus size={14} /></button>
                          <span className="w-10 text-center font-black text-sm">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.product.id, 1)}
                            className="px-3 hover:bg-slate-50 text-brand-red border-l border-slate-100"
                          ><Plus size={14} /></button>
                        </div>
                        <span className="font-black text-brand-blue text-sm">
                          ${(item.product.price_base * item.qty).toLocaleString()}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-6 bg-slate-900 text-white space-y-6 rounded-t-[2.5rem]">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Total Estimado</p>
                    <p className="text-4xl font-black tracking-tighter">${total.toLocaleString()}</p>
                  </div>
                  {isSuccess && (
                    <Badge variant="green" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20 py-2">
                      <CheckCircle2 size={14} className="mr-1" /> Mensaje Armado
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={handleRequestBudget}
                  disabled={cart.length === 0}
                  className="w-full h-16 bg-brand-red hover:bg-rose-700 text-white rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-2xl shadow-red-500/20 active:scale-95 transition-all"
                >
                  <MessageCircle size={20} />
                  Enviar Presupuesto vía WhatsApp
                </Button>
                <p className="text-[9px] text-center text-white/30 font-black uppercase tracking-widest">
                  Te redirigiremos a WhatsApp con tu pedido armado.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
