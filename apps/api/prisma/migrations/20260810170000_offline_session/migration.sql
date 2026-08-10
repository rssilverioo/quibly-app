-- A sessão que nasce em modo avião.
--
-- `client_session_id` é a identidade que o app dá à sessão antes de o servidor
-- conhecê-la; sem ela, um registro tardio que se perca no caminho e seja
-- repetido viraria duas sessões para o mesmo estudo.
--
-- `origin` guarda a trilha: NULL para quem nasceu online (a maioria), e
-- 'offline_start' para quem teve o início declarado pelo aparelho e limitado
-- pelo servidor. Sem isto não há como separar depois o tempo que o servidor
-- testemunhou do que ele aceitou sob palavra.
ALTER TABLE "study_sessions" ADD COLUMN "client_session_id" UUID;
ALTER TABLE "study_sessions" ADD COLUMN "origin" TEXT;

-- Único por usuário, e não global: o id vem do aparelho, e dois aparelhos
-- podem colidir sem que isso seja problema de ninguém. NULLs não colidem entre
-- si no Postgres, então as sessões online (a maioria) ficam livres.
CREATE UNIQUE INDEX "study_sessions_user_id_client_session_id_key"
  ON "study_sessions"("user_id", "client_session_id");
