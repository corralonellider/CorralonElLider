import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input, Card } from '../components/ui';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { cn } from '../components/ui';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message === 'Invalid login credentials' 
        ? 'Credenciales incorrectas. Verifica tu email y contraseña.' 
        : error.message);
      setLoading(false);
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-100 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-red rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-brand-blue rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-slate-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-4000" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center text-white font-black text-4xl shadow-xl shadow-brand-red/20 border border-red-500/30 transform -rotate-6">
            L
          </div>
        </div>
        <h2 className="text-center text-3xl font-black text-slate-900 tracking-tight">
          El Líder<span className="text-brand-red">.</span>
        </h2>
        <p className="mt-2 text-center text-sm font-bold tracking-widest uppercase text-slate-400">
          Gestión Interna Privada
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="py-8 px-4 sm:px-10 shadow-2xl border-white bg-white/80 backdrop-blur-xl">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-white/50 focus:bg-white transition-colors"
                  placeholder="admin@ellider.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 bg-white/50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full h-12 text-sm font-black tracking-widest uppercase transition-all shadow-lg",
                  loading ? "bg-slate-800" : "bg-brand-blue hover:bg-slate-800 shadow-blue-500/20"
                )}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Verificando...
                  </span>
                ) : (
                  'Ingresar al Sistema'
                )}
              </Button>
            </div>
          </form>
          
          <div className="mt-8 text-center text-xs font-medium text-slate-400 border-t pt-6">
            <p>Acceso restringido a personal autorizado.</p>
            <p className="mt-1">© {new Date().getFullYear()} Corralón El Líder</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
