-- Apagar mensagem passa a ser marcação, não remoção.
--
-- `deleted_at` é quando o autor apagou: a mensagem some da conversa e a linha
-- fica, porque a prova de abuso não pode ir embora junto com a mensagem.
--
-- `purged_at` é quando o conteúdo venceu o prazo de retenção e foi esvaziado.
-- Autor, data e hora sobrevivem ao expurgo — é o que sustenta uma investigação
-- sem guardar texto de usuário indefinidamente.
ALTER TABLE "chat_messages"
  ADD COLUMN "deleted_at" TIMESTAMPTZ,
  ADD COLUMN "purged_at"  TIMESTAMPTZ;

-- O expurgo varre por "apagadas antes de tal data, ainda com conteúdo".
-- Sem índice ele faria varredura completa a cada execução.
CREATE INDEX "chat_messages_deleted_at_idx" ON "chat_messages" ("deleted_at");
