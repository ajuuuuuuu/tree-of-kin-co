GRANT SELECT ON public.persons TO anon;
GRANT SELECT ON public.relationships TO anon;
DROP POLICY IF EXISTS "authenticated read persons" ON public.persons;
DROP POLICY IF EXISTS "authenticated read relationships" ON public.relationships;
CREATE POLICY "public read persons" ON public.persons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read relationships" ON public.relationships FOR SELECT TO anon, authenticated USING (true);