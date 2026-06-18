-- ================================================================
-- PASSO 1/3 — Tabelas e Políticas RLS
-- Cole e rode APENAS este bloco primeiro
-- ================================================================

-- Tabela de participantes
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

DROP POLICY IF EXISTS "insert_anonimo"               ON public.participants;
DROP POLICY IF EXISTS "leitura_publica"              ON public.participants;
DROP POLICY IF EXISTS "atualizacao_publica"          ON public.participants;
DROP POLICY IF EXISTS "Permitir inserção anônima"    ON public.participants;
DROP POLICY IF EXISTS "Permitir leitura pública"     ON public.participants;
DROP POLICY IF EXISTS "Permitir atualização pública" ON public.participants;

CREATE POLICY "insert_anonimo"      ON public.participants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "leitura_publica"     ON public.participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "atualizacao_publica" ON public.participants FOR UPDATE TO anon, authenticated USING (true);

-- Tabela de configurações
CREATE TABLE IF NOT EXISTS public.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_settings"             ON public.settings;
DROP POLICY IF EXISTS "atualizacao_settings"         ON public.settings;
DROP POLICY IF EXISTS "insercao_settings"            ON public.settings;
DROP POLICY IF EXISTS "Permitir leitura pública"     ON public.settings;
DROP POLICY IF EXISTS "Permitir atualização pública" ON public.settings;
DROP POLICY IF EXISTS "Permitir inserção pública"    ON public.settings;

CREATE POLICY "leitura_settings"     ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "atualizacao_settings" ON public.settings FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "insercao_settings"    ON public.settings FOR INSERT TO anon, authenticated WITH CHECK (true);

INSERT INTO public.settings (key, value)
VALUES ('guesses_locked', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

SELECT 'PASSO 1 OK' AS resultado;
