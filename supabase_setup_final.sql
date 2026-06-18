-- ================================================================
-- SCRIPT CORRIGIDO COMPLETO — Bolão Brasil × Haiti
-- Execute TODO este bloco de uma vez no SQL Editor do Supabase
-- ================================================================

-- ── 1. TABELA PARTICIPANTES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.participants (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome                text NOT NULL,
  palpite_brasil      integer NOT NULL,
  palpite_adversario  integer NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  comprovante_nome    text,
  comprovante_url     text,
  is_organizer        boolean DEFAULT false,
  created_at          timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_anonimo"      ON public.participants;
DROP POLICY IF EXISTS "leitura_publica"     ON public.participants;
DROP POLICY IF EXISTS "atualizacao_publica" ON public.participants;
DROP POLICY IF EXISTS "Permitir inserção anônima"   ON public.participants;
DROP POLICY IF EXISTS "Permitir leitura pública"    ON public.participants;
DROP POLICY IF EXISTS "Permitir atualização pública" ON public.participants;

CREATE POLICY "insert_anonimo"
  ON public.participants FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "leitura_publica"
  ON public.participants FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "atualizacao_publica"
  ON public.participants FOR UPDATE TO anon, authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
END $$;

-- ── 2. TABELA SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_settings"      ON public.settings;
DROP POLICY IF EXISTS "atualizacao_settings"  ON public.settings;
DROP POLICY IF EXISTS "insercao_settings"     ON public.settings;
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.settings;
DROP POLICY IF EXISTS "Permitir atualização pública" ON public.settings;
DROP POLICY IF EXISTS "Permitir inserção pública"   ON public.settings;

CREATE POLICY "leitura_settings"
  ON public.settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "atualizacao_settings"
  ON public.settings FOR UPDATE TO anon, authenticated
  USING (true);

CREATE POLICY "insercao_settings"
  ON public.settings FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
END $$;

INSERT INTO public.settings (key, value)
VALUES ('guesses_locked', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── 3. BUCKET DE STORAGE ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880;

-- Remover políticas antigas de storage
DROP POLICY IF EXISTS "upload_comprovantes"   ON storage.objects;
DROP POLICY IF EXISTS "leitura_comprovantes"  ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode fazer upload de comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode ler comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Upload público de comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Leitura pública de comprovantes" ON storage.objects;

-- Criar políticas corretas para acesso anônimo ao storage
CREATE POLICY "upload_comprovantes"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "leitura_comprovantes"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'comprovantes');

CREATE POLICY "delete_comprovantes"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'comprovantes');

-- ── 4. VERIFICAÇÃO FINAL ────────────────────────────────────────
SELECT 'participants' AS tabela, COUNT(*) AS registros FROM public.participants
UNION ALL
SELECT 'settings', COUNT(*) FROM public.settings;

SELECT key, value FROM public.settings;

SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'comprovantes';
