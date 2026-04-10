-- SQL para Supabase - Corralón El Líder (Arquitectura Robusta y Escalable)

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

-- 3. Listas de Precios (Flexibilidad solicitada)
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  percentage_adj DECIMAL(5,2) DEFAULT 0, -- Ajuste porcentual sobre base
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
  price_base DECIMAL(12,2) DEFAULT 0, -- Precio de referencia base
  on_order BOOLEAN DEFAULT false, -- Productos bajo pedido
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
  min_quantity DECIMAL(12,2) DEFAULT 1, -- Para precios por volumen
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
  reference_id UUID, -- UUID de Venta o Compra
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Cuenta Corriente Clientes (Ledger)
CREATE TABLE IF NOT EXISTS customer_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('DEBITO', 'CREDITO')), -- DEBITO: Deuda, CREDITO: Pago/Saldo a favor
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  reference_id UUID, -- ID de la Venta o Pago
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Cotizaciones
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

-- 11. Items de Cotización
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

-- 13. Items de Venta
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

-- 14. Caja Diaria (Sesiones)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance DECIMAL(12,2) DEFAULT 0,
  closing_balance DECIMAL(12,2),
  status TEXT CHECK (status IN ('ABIERTA', 'CERRADA')) DEFAULT 'ABIERTA'
);

-- 15. Pagos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE, -- Necesario para pagos a CC sin venta directa
  amount DECIMAL(12,2) NOT NULL,
  method TEXT CHECK (method IN ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'CUENTA_CORRIENTE')),
  reference_code TEXT, -- Nro de transaccion/cheque
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

-- 17. Funciones y Triggers (Automatización de Negocio)

-- Función para actualizar stock al crear movimiento
CREATE OR REPLACE FUNCTION update_inventory_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.type IN ('IN', 'RETURN')) THEN
      UPDATE inventory SET stock_current = stock_current + NEW.quantity WHERE product_id = NEW.product_id;
    ELSIF (NEW.type IN ('OUT', 'SALE', 'LOSS')) THEN
      UPDATE inventory SET stock_current = stock_current - NEW.quantity WHERE product_id = NEW.product_id;
    ELSIF (NEW.type = 'ADJ') THEN
      UPDATE inventory SET stock_current = NEW.quantity WHERE product_id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_inventory
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION update_inventory_on_movement();

-- SEED DATA (Basado en el cartel de la imagen)
INSERT INTO categories (name, description) VALUES 
('Materiales Gruesos', 'Arena, cemento, piedra, cal, etc.'),
('Terminaciones', 'Cerámicos, porcelanatos, revestimientos'),
('Sanitarios', 'Grifería, loza, piletas'),
('Ferretería', 'Herramientas y accesorios'),
('Áridos', 'Arena, piedra partida, cascote'),
('Chapa y Hierro', 'Hierros para construcción, chapas de techo'),
('Pintura', 'Látex, sintéticos, impermeabilizantes');

INSERT INTO price_lists (name, description, is_default) VALUES 
('Público', 'Precio de mostrador estándar', true),
('Gremio', 'Precio preferencial para albañiles/constructores', false),
('Mayorista', 'Precio por volumen', false);
