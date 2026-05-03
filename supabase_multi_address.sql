-- Migración: Soporte para múltiples domicilios por cliente (Constructoras)

CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  is_default BOOLEAN DEFAULT false,
  notes TEXT, -- Ej: "Obra Edificio Sur", "Horario de recepción 8 a 14hs"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si se quiere migrar la dirección actual de los clientes a la nueva tabla:
INSERT INTO customer_addresses (customer_id, address, is_default, notes)
SELECT id, address, true, 'Domicilio Principal (Migrado)'
FROM customers
WHERE address IS NOT NULL AND address != '';

-- Opcional: Eliminar la columna address de customers si se desea forzar el uso de la nueva tabla
-- ALTER TABLE customers DROP COLUMN address;
