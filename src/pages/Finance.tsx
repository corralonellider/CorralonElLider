import React, { useState } from 'react';
import { Wallet, History, FileText } from 'lucide-react';
import { Cash } from './Cash';
import { SalesHistory } from './SalesHistory';
import { cn } from '../components/ui';

export const Finance = () => {
  const [activeTab, setActiveTab] = useState<'caja' | 'historial'>('caja');

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Wallet className="text-brand-blue" />
            Finanzas y Caja
          </h1>
          <p className="text-slate-500 text-sm mt-1">Control de caja diaria e historial de facturación.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('caja')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 relative -mb-px",
            activeTab === 'caja' 
              ? "text-brand-blue border-brand-blue bg-blue-50/50 rounded-t-xl" 
              : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50 rounded-t-xl"
          )}
        >
          <Wallet size={18} />
          Caja Diaria
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 relative -mb-px",
            activeTab === 'historial' 
              ? "text-brand-blue border-brand-blue bg-blue-50/50 rounded-t-xl" 
              : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50 rounded-t-xl"
          )}
        >
          <History size={18} />
          Historial de Ventas
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'caja' ? <Cash isTab={true} /> : <SalesHistory isTab={true} />}
      </div>
    </div>
  );
};
