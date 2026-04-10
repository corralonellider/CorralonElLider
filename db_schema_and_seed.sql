-- SQL para Supabase - Corralón El Líder (Arquitectura Robusta y Escalable) con Semillas de Datos

-- 0. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Perfiles y Roles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('dueño', 'administrador', 'vendedor', 'deposito')) DEFAULT 'vendedor',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Categorías
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Listas de Precios
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  percentage_adj DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Productos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  internal_code TEXT UNIQUE NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  unit TEXT DEFAULT 'unidad',
  cost DECIMAL(12,2) DEFAULT 0,
  price_base DECIMAL(12,2) DEFAULT 0,
  on_order BOOLEAN DEFAULT false,
  visible_web BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Precios por Producto y Lista
CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,
  price DECIMAL(12,2) NOT NULL,
  min_quantity DECIMAL(12,2) DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, price_list_id, min_quantity)
);

-- 6. Clientes
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  doc_type TEXT CHECK (doc_type IN ('DNI', 'CUIT', 'CUIL', 'PASAPORTE')) DEFAULT 'DNI',
  doc_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inventario
CREATE TABLE IF NOT EXISTS inventory (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  stock_current DECIMAL(12,2) DEFAULT 0,
  stock_min DECIMAL(12,2) DEFAULT 0,
  stock_reserved DECIMAL(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Movimientos de Inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(12,2) NOT NULL,
  type TEXT CHECK (type IN ('IN', 'OUT', 'ADJ', 'SALE', 'RETURN', 'LOSS')),
  description TEXT,
  reference_id UUID,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Caja Diaria (Sesiones) (Adelantado por dependencias)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance DECIMAL(12,2) DEFAULT 0,
  closing_balance DECIMAL(12,2),
  status TEXT CHECK (status IN ('ABIERTA', 'CERRADA')) DEFAULT 'ABIERTA'
);

-- 9. Cotizaciones
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES profiles(id),
  total DECIMAL(12,2) DEFAULT 0,
  status TEXT CHECK (status IN ('PENDIENTE', 'CONVERTIDA', 'VENCIDA', 'CANCELADA')) DEFAULT 'PENDIENTE',
  valid_until TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

-- 12. Ventas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES profiles(id),
  total DECIMAL(12,2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('PENDIENTE', 'PARCIAL', 'COMPLETO')) DEFAULT 'PENDIENTE',
  delivery_status TEXT CHECK (delivery_status IN ('PENDIENTE', 'EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO', 'RETIRO_LLAVERO')) DEFAULT 'PENDIENTE',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

-- 15. Pagos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  method TEXT CHECK (method IN ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'CUENTA_CORRIENTE')),
  reference_code TEXT,
  session_id UUID REFERENCES cash_sessions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Entregas (Logística)
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  scheduled_date DATE,
  status TEXT CHECK (status IN ('PENDIENTE', 'EN_CAMINO', 'ENTREGADO', 'FALLIDO')),
  address TEXT,
  tracking_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- SEED DATA - DATOS INICIALES PARA EL CORRALÓN
INSERT INTO categories (name, description) VALUES 
('Materiales Gruesos', 'Arena, cemento, piedra, cal, etc.'),
('Terminaciones', 'Cerámicos, porcelanatos, revestimientos'),
('Sanitarios', 'Grifería, loza, piletas'),
('Ferretería', 'Herramientas y accesorios'),
('Áridos', 'Arena, piedra partida, cascote'),
('Chapa y Hierro', 'Hierros para construcción, chapas de techo'),
('Pintura', 'Látex, sintéticos, impermeabilizantes') ON CONFLICT (name) DO NOTHING;

INSERT INTO price_lists (name, description, is_default) VALUES 
('Público', 'Precio de mostrador estándar', true),
('Gremio', 'Precio preferencial para albañiles/constructores', false),
('Mayorista', 'Precio por volumen', false) ON CONFLICT (name) DO NOTHING;


-- BLOQUE PARA CARGAR PRODUCTOS Y SU STOCK DE FORMA AUTOMÁTICA
DO $$
DECLARE
  cat_gruesos UUID;
  cat_aridos UUID;
  cat_pintura UUID;
  cat_hierro UUID;
  cat_ferreteria UUID;
  prod_id UUID;
  list_publico UUID;
BEGIN
  -- Obtener IDs de categorías
  SELECT id INTO cat_gruesos FROM categories WHERE name = 'Materiales Gruesos' LIMIT 1;
  SELECT id INTO cat_aridos FROM categories WHERE name = 'Áridos' LIMIT 1;
  SELECT id INTO cat_pintura FROM categories WHERE name = 'Pintura' LIMIT 1;
  SELECT id INTO cat_hierro FROM categories WHERE name = 'Chapa y Hierro' LIMIT 1;
  SELECT id INTO cat_ferreteria FROM categories WHERE name = 'Ferretería' LIMIT 1;
  
  -- Obtener ID de la lista de precio por defecto
  SELECT id INTO list_publico FROM price_lists WHERE name = 'Público' LIMIT 1;

  -- 1: Cemento
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('CEM-01', 'Cemento Loma Negra 50kg', cat_gruesos, 7000, 9500, 'bolsa')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 9500);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 250, 50);

  -- 2: Cal
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('CAL-01', 'Cal Hidratada Cacique 25kg', cat_gruesos, 3500, 5200, 'bolsa')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 5200);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 180, 40);

  -- 3: Arena
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('ARE-01', 'Arena de Río (por Metro Cúbico)', cat_aridos, 9000, 14500, 'Metro Cúbico')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 14500);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 80, 15);

  -- 4: Piedra Partida
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('PIE-01', 'Piedra Partida 6/20', cat_aridos, 11000, 16800, 'Metro Cúbico')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 16800);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 45, 10);

  -- 5: Hierro 8mm
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('HIE-08', 'Hierro Aletado Acindar 8mm (Varilla 12m)', cat_hierro, 4200, 6500, 'varilla')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 6500);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 400, 100);

  -- 6: Malla Cima
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('MAL-15', 'Malla Sima 15x15 4,2mm', cat_hierro, 22000, 31000, 'panel')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 31000);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 65, 20);

  -- 7: Ladrillo Hueco 12
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('LAD-12', 'Ladrillo Hueco 12x18x33', cat_gruesos, 280, 420, 'unidad')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 420);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 6000, 1000);

  -- 8: Pintura Latex
  INSERT INTO products (internal_code, name, category_id, cost, price_base, unit)
  VALUES ('PTA-01', 'Pintura Látex Interior Alba 20 Lts', cat_pintura, 35000, 48500, 'lata')
  RETURNING id INTO prod_id;
  INSERT INTO product_prices (product_id, price_list_id, price) VALUES (prod_id, list_publico, 48500);
  INSERT INTO inventory (product_id, stock_current, stock_min) VALUES (prod_id, 25, 5);

END $$;
