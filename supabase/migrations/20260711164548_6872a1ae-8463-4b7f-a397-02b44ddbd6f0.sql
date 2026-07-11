DROP POLICY "public read persons" ON public.persons;
DROP POLICY "public read relationships" ON public.relationships;
REVOKE SELECT ON public.persons FROM anon;
REVOKE SELECT ON public.relationships FROM anon;
CREATE POLICY "authenticated read persons" ON public.persons FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read relationships" ON public.relationships FOR SELECT TO authenticated USING (true);