-- 1. Criar a tabela de Participantes
CREATE TABLE public.participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  palpite_brasil integer NOT NULL,
  palpite_adversario integer NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  comprovante_nome text,
  comprovante_url text,
  is_organizer boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar o RLS (Row Level Security) para permitir que qualquer um insira, mas só vejam seus próprios ou todos se for publico
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode inserir (anônimo)
CREATE POLICY "Permitir inserção anônima" ON public.participants
  FOR INSERT WITH CHECK (true);

-- Política: Qualquer um pode ler os dados
CREATE POLICY "Permitir leitura pública" ON public.participants
  FOR SELECT USING (true);

-- Política: Qualquer um pode atualizar (simplificado para o painel de admin local)
CREATE POLICY "Permitir atualização pública" ON public.participants
  FOR UPDATE USING (true);

-- 3. Habilitar o Realtime para a tabela
alter publication supabase_realtime add table public.participants;

-- 4. Criar o bucket do Storage para os comprovantes
insert into storage.buckets (id, name, public) 
values ('comprovantes', 'comprovantes', true);

-- Políticas do Storage: Qualquer um pode fazer upload
create policy "Qualquer um pode fazer upload de comprovantes"
on storage.objects for insert
with check ( bucket_id = 'comprovantes' );

-- Políticas do Storage: Qualquer um pode ver as imagens
create policy "Qualquer um pode ler comprovantes"
on storage.objects for select
using ( bucket_id = 'comprovantes' );

-- 5. Criar a tabela de Configurações (Settings) para bloqueio de palpites
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Permitir atualização pública" ON public.settings FOR UPDATE USING (true);
CREATE POLICY "Permitir inserção pública" ON public.settings FOR INSERT WITH CHECK (true);

-- Habilitar Realtime para settings
alter publication supabase_realtime add table public.settings;

-- Inserir configuração inicial
INSERT INTO public.settings (key, value) VALUES ('guesses_locked', 'false'::jsonb);
