-- Add new price fields to sale_package_prices
ALTER TABLE public.sale_package_prices
ADD COLUMN is_exact_price BOOLEAN DEFAULT true,
ADD COLUMN price_percentage NUMERIC,
ADD COLUMN price_exact NUMERIC;