-- ================================================================
-- PASSO 3/3 — Storage (rode DEPOIS do passo 1)
-- Cole e rode APENAS este bloco
-- ================================================================

-- Criar/atualizar bucket de comprovantes
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comprovantes', 'comprovantes', true, 5242880)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

-- Remover políticas antigas
DROP POLICY IF EXISTS "upload_comprovantes"                        ON storage.objects;
DROP POLICY IF EXISTS "leitura_comprovantes"                       ON storage.objects;
DROP POLICY IF EXISTS "delete_comprovantes"                        ON storage.objects;
DROP POLICY IF EXISTS "Upload público de comprovantes"             ON storage.objects;
DROP POLICY IF EXISTS "Leitura pública de comprovantes"            ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode fazer upload de comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode ler comprovantes"          ON storage.objects;

-- Criar políticas corretas com acesso anônimo explícito
CREATE POLICY "upload_comprovantes"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "leitura_comprovantes"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'comprovantes');

-- Verificar resultado
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'comprovantes';
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

SELECT 'PASSO 3 OK' AS resultado;
