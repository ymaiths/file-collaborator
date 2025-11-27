-- Add column to track if price is percentage-based or exact value
ALTER TABLE public.sale_package_prices
ADD COLUMN is_percent_price BOOLEAN DEFAULT false;