-- O selo, concedido pelo painel e nunca por rota de usuário — ver a nota no
-- schema sobre por que ele não pode ser comprável.
--
-- Enum anulável e não booleano com um tipo ao lado: assim é impossível existir
-- "verificado sem tipo" ou "tipo sem verificação", dois estados inválidos que
-- o banco não teria como proibir.
CREATE TYPE "VerificationBadge" AS ENUM ('BLUE', 'GOLD');

ALTER TABLE "profiles" ADD COLUMN "verification" "VerificationBadge";

-- Índice parcial: a esmagadora maioria das linhas é nula, e o painel e a busca
-- só se interessam por quem tem selo.
CREATE INDEX "profiles_verification_idx" ON "profiles"("verification")
    WHERE "verification" IS NOT NULL;
