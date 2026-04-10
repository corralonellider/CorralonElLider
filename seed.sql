-- Seed data for Corralón El Líder

-- 1. Categorías
INSERT INTO categories (name, description) VALUES 
('Gruesos', 'Materiales de construcción base: cemento, cal, ladrillos'),
('Áridos', 'Arena, piedra, cascote'),
('Pintura', 'Látex, sintéticos, impermeabilizantes'),
('Ferretería', 'Herramientas, tornillería, clavos');

-- 2. Productos (Ejemplos)
INSERT INTO products (internal_code, name, category_id, price_retail, cost, stock_current, stock_min, unit)
SELECT 'CEM-01', 'Cemento Holcim 50kg', id, 8500, 6200, 120, 50, 'bolsa' FROM categories WHERE name = 'Gruesos';

INSERT INTO products (internal_code, name, category_id, price_retail, cost, stock_current, stock_min, unit)
SELECT 'ARE-01', 'Arena Lavada m3', id, 12000, 7000, 15, 10, 'm3' FROM categories WHERE name = 'Áridos';

INSERT INTO products (internal_code, name, category_id, price_retail, cost, stock_current, stock_min, unit)
SELECT 'LAD-01', 'Ladrillo Hueco 12x18x33', id, 450, 310, 2500, 1000, 'unidad' FROM categories WHERE name = 'Gruesos';

-- 3. Clientes
INSERT INTO customers (name, type, phone, address) VALUES
('Juan Pérez', 'vecino', '1122334455', 'Calle Falsa 123'),
('Constructora S.A.', 'empresa', '1199887766', 'Av. Libertador 4500');
