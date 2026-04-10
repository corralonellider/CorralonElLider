import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge, Input, cn } from '../components/ui';

import { 
  Plus, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  Package,
  Layers,
  ChevronDown,
  X,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';


interface Product {
  id: string;
  internal_code: string;
  name: string;
  unit: string;
  price_base: number;
  cost: number;
  active: boolean;
  category: { name: string } | null;
  category_id?: string;
  image_url?: string;
  inventory?: { stock_current: number; stock_min: number };
}

export const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    internal_code: '',
    name: '',
    unit: 'UNID',
    price_base: 0,
    cost: 0,
    category_id: '',
    initial_stock: 0,
    stock_min: 0,
    image_url: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustment, setAdjustment] = useState({ amount: 0, type: 'ADJUSTMENT', description: '' });
  const [editingProduct, setEditingProduct] = useState<any>(null);



  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };


  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(name), inventory:inventory(stock_current, stock_min)')
      .order('name');
    
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Insert product
    const { data: product, error: pError } = await supabase
      .from('products')
      .insert([{
        internal_code: newProduct.internal_code,
        name: newProduct.name,
        unit: newProduct.unit,
        price_base: newProduct.price_base,
        cost: newProduct.cost,
        category_id: newProduct.category_id || null,
        image_url: newProduct.image_url
      }])
      .select()
      .single();

    if (pError) {
      console.error(pError);
      alert('Error al crear producto: ' + pError.message);
      setLoading(false);
      return;
    }


    // 2. Insert initial inventory
    await supabase.from('inventory').insert([{
      product_id: product.id,
      stock_current: newProduct.initial_stock,
      stock_min: newProduct.stock_min
    }]);

    // 3. Insert initial price for list 'MINORISTA'
    await supabase.from('product_prices').insert([{
      product_id: product.id,
      price: newProduct.price_base,
      price_list_id: (await supabase.from('price_lists').select('id').eq('is_default', true).single()).data?.id || null
    }]);

    setIsAddModalOpen(false);
    setNewProduct({
      internal_code: '',
      name: '',
      unit: 'UNID',
      price_base: 0,
      cost: 0,
      category_id: '',
      initial_stock: 0,
      stock_min: 0,
      image_url: ''
    });
    fetchProducts();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    try {
      setUploadingImage(true);
      const file = e.target.files?.[0];
      if (!file) return;

      // Validar tamaño (Máx 4MB para estar seguros)
      if (file.size > 4 * 1024 * 1024) {
        alert('La imagen es muy pesada (máximo 4MB)');
        return;
      }

      console.log('Subiendo archivo:', file.name, 'a bucket: product-images');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error Supabase Storage:', uploadError);
        throw new Error(`Supabase dice: ${uploadError.message}`);
      }

      console.log('Upload exitoso:', uploadData);

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      
      if (isEditing) {
        setEditingProduct(prev => ({ ...prev, image_url: data.publicUrl }));
      } else {
        setNewProduct(prev => ({ ...prev, image_url: data.publicUrl }));
      }
      alert('¡Imagen subida con éxito!');

    } catch (error: any) {
      console.error('Error crítico subiendo:', error);
      alert('ERROR AL SUBIR: ' + error.message + '\n\nVerifica que el Bucket "product-images" exista y sea PÚBLICO.');
    } finally {
      setUploadingImage(false);
      // Limpiar el input para permitir re-subir el mismo archivo si falló
      e.target.value = '';
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);

    const { error } = await supabase
      .from('products')
      .update({
        internal_code: editingProduct.internal_code,
        name: editingProduct.name,
        unit: editingProduct.unit,
        price_base: editingProduct.price_base,
        cost: editingProduct.cost,
        category_id: editingProduct.category_id || null,
        image_url: editingProduct.image_url
      })
      .eq('id', editingProduct.id);

    if (error) {
      alert('Error al actualizar: ' + error.message);
    } else {
      setIsEditModalOpen(false);
      fetchProducts();
    }
    setLoading(false);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoading(true);

    const newStock = (selectedProduct.inventory?.stock_current || 0) + adjustment.amount;

    // 1. Update inventory
    const { error: invError } = await supabase
      .from('inventory')
      .update({ stock_current: newStock, updated_at: new Date().toISOString() })
      .eq('product_id', selectedProduct.id);

    if (invError) {
      console.error(invError);
      setLoading(false);
      return;
    }

    // 2. Record movement
    await supabase.from('inventory_movements').insert([{
      product_id: selectedProduct.id,
      quantity: adjustment.amount,
      type: adjustment.type,
      description: adjustment.description || 'Ajuste manual de stock'
    }]);

    setIsAdjustModalOpen(false);
    setSelectedProduct(null);
    setAdjustment({ amount: 0, type: 'ADJUSTMENT', description: '' });
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este producto?')) return;
    
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchProducts();
  };

  const handleQuickAddCategory = async () => {
    const name = prompt('Nombre de la nueva categoría:');
    if (!name) return;

    const { data, error } = await supabase.from('categories').insert([{ name }]).select().single();
    if (data) {
      setCategories([...categories, data]);
      setNewProduct({...newProduct, category_id: data.id});
    }
  };

  const handleDeleteCategory = async () => {
    if (!newProduct.category_id) return;
    const cat = categories.find(c => c.id === newProduct.category_id);
    if (!cat) return;
    
    if (!confirm(`¿Está seguro de que desea eliminar la categoría "${cat.name}"? Los productos asociados quedarán sin categoría.`)) return;

    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (!error) {
      setCategories(categories.filter(c => c.id !== cat.id));
      setNewProduct({...newProduct, category_id: ''});
    } else {
      alert('No se pudo eliminar la categoría. Asegúrese de que no tenga dependencias restrictivas.');
    }
  };


  const downloadTemplate = () => {
    const headers = ['ARTICULOS', 'PRECIO', 'PRECIO DE VENTA'];
    const rows = [
      ['ARENA EN BOLSON', '24900.00', '46000.00'],
      ['PIEDRA PARTIDA EN BOLSON', '45200.00', '85000.00'],
      ['CEMENTO HOLCIM X 25KG', '5320.00', '7000.00']
    ];
    
    let csvContent = "\ufeff" // BOM for Excel encoding
      + headers.join(";") + "\r\n"
      + rows.map(e => e.join(";")).join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "lista_precios_corralon.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.internal_code.toLowerCase().includes(search.toLowerCase())
  );


  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('--- Iniciando Importación de:', file.name, '---');
    setLoading(true);

    try {
      const processData = async (data: any[], headers: string[]) => {
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        console.log('Fila de muestra:', data[0]);

        for (const row of data) {
          try {
            const getField = (searchTerms: string[]) => {
              const keys = Object.keys(row);
              const matchedKey = keys.find(k => {
                const kClean = String(k).trim().toUpperCase();
                return searchTerms.some(term => kClean.includes(term.toUpperCase()));
              });
              return matchedKey ? row[matchedKey] : null;
            };

            const name = getField(['ARTICULO', 'NOMBRE', 'PRODUCTO', 'DESCRIPCION']);
            const costRaw = getField(['PRECIO', 'COSTO', 'COMPRA', 'COST']);
            const priceRaw = getField(['PRECIO DE VENTA', 'VENTA', 'PRICE', 'PUBLICO']);
            const stockRaw = getField(['STOCK', 'EXISTENCIA', 'CANTIDAD', 'QTY', 'INVENTARIO']);

            if (!name || String(name).trim() === "" || String(name).toUpperCase() === 'ARTICULOS') {
              skipped++;
              continue;
            }

            const parseAmount = (raw: any): number => {
              if (typeof raw === 'number') return raw;
              if (!raw) return 0;
              let s = String(raw).replace(/[$\s]/g, '').trim();
              if (s.includes('.') && s.includes(',')) {
                if (s.indexOf('.') < s.indexOf(',')) s = s.replace(/\./g, '').replace(',', '.');
                else s = s.replace(/,/g, '');
              } else if (s.includes(',')) s = s.replace(',', '.');
              return parseFloat(s) || 0;
            };

            const cost = parseAmount(costRaw);
            const price = parseAmount(priceRaw);
            const stock = parseAmount(stockRaw);
            const code = String(name).trim().slice(0, 3).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

            const { data: existing, error: findErr } = await supabase.from('products').select('id').eq('name', String(name).trim()).maybeSingle();
            if (findErr) throw new Error(`Error buscando: ${findErr.message}`);

            let pid;
            if (existing) {
              const { error: upErr } = await supabase.from('products').update({ cost, price_base: price }).eq('id', existing.id);
              if (upErr) throw new Error(`Error actualizando: ${upErr.message}`);
              
              const { error: invErr } = await supabase.from('inventory').update({ stock_current: stock }).eq('product_id', existing.id);
              if (invErr) throw new Error(`Error actualizando stock: ${invErr.message}`);
              
              pid = existing.id;
            } else {
              const { data: created, error: createErr } = await supabase.from('products').insert([{
                name: String(name).trim(),
                cost,
                price_base: price,
                internal_code: code,
                unit: 'UNID',
                active: true
              }]).select().single();
              if (createErr) throw new Error(`Error creando: ${createErr.message}`);
              pid = created.id;
              await supabase.from('inventory').insert([{ product_id: pid, stock_current: stock }]);
            }

            const { data: defPriceList } = await supabase.from('price_lists').select('id').eq('is_default', true).limit(1).maybeSingle();
            if (defPriceList) {
              await supabase.from('product_prices').upsert([{
                product_id: pid,
                price_list_id: defPriceList.id,
                price: price,
                min_quantity: 1
              }], { onConflict: 'product_id,price_list_id,min_quantity' });
            }

            imported++;
          } catch (err: any) {
            console.error('Error en fila:', row, err);
            errors.push(`${row['ARTICULOS'] || 'Fila s/n'}: ${err.message}`);
          }
        }

        const msg = [
          `Importación finalizada:`,
          `- Exitosos: ${imported}`,
          `- Fallidos: ${errors.length}`,
          `- Omitidos: ${skipped}`
        ];

        if (errors.length > 0) msg.push(`\nPrimeros errores:\n${errors.slice(0, 3).join('\n')}`);
        if (imported === 0 && skipped > 0 && errors.length === 0) {
          msg.push(`\nNota: Se omitieron todas las filas. Verifica que los datos no estén en la fila de encabezados.`);
        }

        alert(msg.join('\n'));
        fetchProducts();
        setLoading(false);
        e.target.value = ''; // Reset input to allow re-uploading same file
      };

      if (file.name.endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[];
            processData(data, headers);
          } catch (err: any) {
            console.error('Error leyendo Excel:', err.message);
            alert('Error al leer el archivo Excel: ' + err.message);
            setLoading(false);
          }
        };
        reader.readAsBinaryString(file);
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: 'greedy',
          delimiter: "",
          transformHeader: (h) => h.trim(),
          complete: (results) => processData(results.data, results.meta.fields || []),
          error: (err) => {
            alert('Error al leer el archivo CSV: ' + err.message);
            setLoading(false);
          }
        });
      }
    } catch (err: any) {
      console.error('Error crítico en importador:', err.message);
      alert('Error crítico: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
             <Package size={32} className="text-brand-red" />
             Stock de Materiales
           </h1>
           <p className="text-slate-500 mt-1">Gestión centralizada de productos y reposición.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="bg-white" onClick={downloadTemplate}>
            <Download size={18} /> Plantilla
          </Button>

          <label className="cursor-pointer">
            <input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleBulkUpload} />
            <div className="btn-secondary inline-flex items-center gap-2 h-10 px-4">
              <Upload size={18} /> Importar Excel
            </div>
          </label>
          <Button className="h-10 px-6" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Nuevo Producto
          </Button>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Summary */}
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-brand-blue flex items-center justify-center">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Total SKUs</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{products.length}</h3>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Bajo Mínimo</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {products.filter(p => (p.inventory?.stock_current || 0) <= (p.inventory?.stock_min || 0)).length}
            </h3>
          </div>
        </Card>

        <div className="lg:col-span-2">
           <Card className="p-2 h-full flex items-center px-4">
             <Search size={20} className="text-slate-400 mr-3" />
             <input 
                placeholder="Filtro rápido por nombre o código interno..." 
                className="w-full bg-transparent border-none outline-none text-slate-700 font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
             />
           </Card>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-premium bg-white pb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Info Producto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Costo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio Base</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock Actual</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                          <img src={p.image_url} className="w-full h-full object-cover" alt="" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center text-slate-200 shrink-0 border border-slate-100">
                           <ImageIcon size={20} />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-mono font-bold text-brand-blue/60">{p.internal_code}</span>
                        <span className="font-bold text-slate-800 group-hover:text-brand-blue transition-colors truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Unidad: {p.unit}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="blue">{p.category?.name || 'S/C'}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-500">${p.cost.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-black text-slate-900">${p.price_base.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "text-lg font-black",
                        (p.inventory?.stock_current || 0) <= (p.inventory?.stock_min || 0) ? 'text-rose-600' : 'text-emerald-600'
                      )}>
                        {p.inventory?.stock_current || 0}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Mín: {p.inventory?.stock_min || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => {
                          setEditingProduct({
                            ...p,
                            category_id: p.category_id || ''
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-slate-300 hover:text-brand-blue hover:bg-white rounded-lg transition-all shadow-sm"
                        title="Editar Producto"
                      >
                        <Edit3 size={18} />
                      </button>

                      <button 
                        onClick={() => {
                          setSelectedProduct(p);
                          setAdjustment({ amount: 0, type: 'ADJUSTMENT', description: '' });
                          setIsAdjustModalOpen(true);
                        }}
                        className="p-2 text-slate-300 hover:text-amber-500 hover:bg-white rounded-lg transition-all shadow-sm"
                        title="Ajustar Stock"
                      >
                        <Upload size={18} />
                      </button>

                       <button 
                         onClick={() => handleDeleteProduct(p.id)}
                         className="p-2 text-slate-300 hover:text-rose-500 hover:bg-white rounded-lg transition-all shadow-sm"
                         title="Eliminar"
                       >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {loading && (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-500 mt-4 font-bold">Cargando catálogo...</p>
          </div>
        )}
      </Card>

      {/* Add Product Modal */}

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center text-brand-red">
                  <Plus size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Nuevo Producto</h3>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Foto del Producto</label>
                       <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-slate-100 rounded-2xl hover:border-brand-red/30 transition-all bg-slate-50/50">
                          {newProduct.image_url ? (
                            <div className="relative w-full aspect-square max-w-[200px] rounded-xl overflow-hidden shadow-premium">
                               <img src={newProduct.image_url} className="w-full h-full object-cover" alt="Preview" />
                               <button 
                                 type="button"
                                 onClick={() => setNewProduct({...newProduct, image_url: ''})}
                                 className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg shadow-lg hover:bg-rose-600 transition-all"
                               >
                                 <X size={14} />
                               </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center gap-3 cursor-pointer py-4 w-full">
                               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm">
                                  {uploadingImage ? <div className="w-6 h-6 border-2 border-brand-red border-t-transparent animate-spin rounded-full" /> : <Camera size={32} />}
                               </div>
                               <div className="text-center">
                                 <p className="text-xs font-black text-slate-400 uppercase tracking-tight">Toca para añadir foto</p>
                                 <p className="text-[9px] text-slate-300 uppercase font-bold mt-1">JPG, PNG o WEBP (Máx 2MB)</p>
                               </div>
                               <input 
                                 type="file" 
                                 className="hidden" 
                                 accept="image/*" 
                                 onChange={handleImageUpload}
                                 disabled={uploadingImage}
                               />
                            </label>
                          )}
                       </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Código Interno</label>
                      <Input 
                        required 
                        value={newProduct.internal_code}
                        onChange={e => setNewProduct({...newProduct, internal_code: e.target.value})}
                        placeholder="Ej: CAL-40" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Producto</label>
                      <Input 
                        required 
                        value={newProduct.name}
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="Ej: Cal Hidratada 25kg" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unidad</label>
                        <select 
                          className="w-full input-standard text-sm"
                          value={newProduct.unit}
                          onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                        >
                          <option value="UNID">Unidad</option>
                          <option value="KG">Kilogramos</option>
                          <option value="M3">Metro Cúbico</option>
                          <option value="BOLSA">Bolsa</option>
                          <option value="MT">Metros</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoría</label>
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 input-standard text-sm"
                            value={newProduct.category_id}
                            onChange={e => setNewProduct({...newProduct, category_id: e.target.value})}
                          >
                            <option value="">Sin Categoría</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="p-2 border-slate-200 text-slate-400 hover:text-brand-red"
                            onClick={handleDeleteCategory}
                            disabled={!newProduct.category_id}
                          >
                            <Trash2 size={16} />
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="p-2 border-slate-200"
                            onClick={handleQuickAddCategory}
                          >
                            <Plus size={16} />
                          </Button>

                        </div>

                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Costo ($)</label>
                        <Input 
                          type="number"
                          required
                          value={newProduct.cost}
                          onChange={e => setNewProduct({...newProduct, cost: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Precio Venta ($)</label>
                        <Input 
                          type="number"
                          required
                          value={newProduct.price_base}
                          onChange={e => setNewProduct({...newProduct, price_base: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stock Inicial</label>
                        <Input 
                          type="number"
                          value={newProduct.initial_stock}
                          onChange={e => setNewProduct({...newProduct, initial_stock: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stock Mínimo</label>
                        <Input 
                          type="number"
                          value={newProduct.stock_min}
                          onChange={e => setNewProduct({...newProduct, stock_min: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Utilidad Estimada (Margen)</p>
                       <p className="text-3xl font-black text-emerald-600">
                         {newProduct.price_base > 0 && newProduct.cost > 0 ? ((((newProduct.price_base - newProduct.cost) / newProduct.cost) * 100).toFixed(1) + '%') : '0%'}
                       </p>
                    </div>

                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                   <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                   <Button type="submit" className="px-8 font-black bg-brand-red">GUARDAR PRODUCTO</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue">
                  <Edit3 size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Editar Producto</h3>
              </div>

              <form onSubmit={handleUpdateProduct} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Foto del Producto</label>
                       <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-slate-100 rounded-2xl hover:border-brand-red/30 transition-all bg-slate-50/50">
                          {editingProduct.image_url ? (
                            <div className="relative w-full aspect-square max-w-[200px] rounded-xl overflow-hidden shadow-premium">
                               <img src={editingProduct.image_url} className="w-full h-full object-cover" alt="Preview" />
                               <button 
                                 type="button"
                                 onClick={() => setEditingProduct({...editingProduct, image_url: ''})}
                                 className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg shadow-lg hover:bg-rose-600 transition-all"
                               >
                                 <X size={14} />
                               </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center gap-3 cursor-pointer py-4 w-full">
                               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm">
                                  {uploadingImage ? <div className="w-6 h-6 border-2 border-brand-red border-t-transparent animate-spin rounded-full" /> : <Camera size={32} />}
                               </div>
                               <div className="text-center">
                                 <p className="text-xs font-black text-slate-400 uppercase tracking-tight">Toca para añadir foto</p>
                               </div>
                               <input 
                                 type="file" 
                                 className="hidden" 
                                 accept="image/*" 
                                 onChange={(e) => handleImageUpload(e, true)}
                                 disabled={uploadingImage}
                               />
                            </label>
                          )}
                       </div>
                       <div className="mt-2 space-y-1.5">
                          <label className="text-[9px] font-bold uppercase text-slate-400">O pega el enlace directo:</label>
                          <Input 
                            value={editingProduct.image_url || ''}
                            onChange={e => setEditingProduct({...editingProduct, image_url: e.target.value})}
                            placeholder="https://ejemplo.com/foto.jpg"
                            className="h-8 text-[11px]"
                          />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Código Interno</label>
                      <Input 
                        required 
                        value={editingProduct.internal_code}
                        onChange={e => setEditingProduct({...editingProduct, internal_code: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre</label>
                      <Input 
                        required 
                        value={editingProduct.name}
                        onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Costo</label>
                        <Input 
                          type="number"
                          value={editingProduct.cost}
                          onChange={e => setEditingProduct({...editingProduct, cost: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Precio Venta</label>
                        <Input 
                          type="number"
                          value={editingProduct.price_base}
                          onChange={e => setEditingProduct({...editingProduct, price_base: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoría</label>
                      <select 
                        className="w-full input-standard text-sm"
                        value={editingProduct.category_id}
                        onChange={e => setEditingProduct({...editingProduct, category_id: e.target.value})}
                      >
                        <option value="">Sin Categoría</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                   <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                   <Button type="submit" className="px-8 font-black bg-brand-blue">GUARDAR CAMBIOS</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>

      {/* Adjust Stock Modal */}
      <AnimatePresence>
        {isAdjustModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-md p-8 relative">
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <Upload size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ajustar Stock</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase">{selectedProduct.name}</p>
                </div>
              </div>

              <form onSubmit={handleAdjustStock} className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center mb-4">
                   <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Actual</p>
                     <p className="text-2xl font-black text-slate-900">{selectedProduct.inventory?.stock_current || 0} {selectedProduct.unit}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Mínimo</p>
                     <p className="text-lg font-bold text-slate-400">{selectedProduct.inventory?.stock_min || 0}</p>
                   </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cantidad a Sumar/Restar</label>
                  <Input 
                    required 
                    type="number"
                    value={adjustment.amount}
                    onChange={e => setAdjustment({...adjustment, amount: Number(e.target.value)})}
                    placeholder="Ej: 10 o -5" 
                  />
                  <p className="text-[10px] text-slate-400 mt-1 italic">* Use números negativos para registros de merma o salida.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Concepto/Motivo</label>
                  <Input 
                    required 
                    value={adjustment.description}
                    onChange={e => setAdjustment({...adjustment, description: e.target.value})}
                    placeholder="Ej: Reposición de mercadería" 
                  />
                </div>

                <Button type="submit" className="w-full h-12 mt-4 font-black bg-amber-600 hover:bg-amber-700">
                  CONFIRMAR AJUSTE
                </Button>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
