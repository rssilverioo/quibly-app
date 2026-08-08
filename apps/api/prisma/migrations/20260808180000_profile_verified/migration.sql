-- O selo de verificado. Concedido pelo painel, nunca por rota de usuário —
-- ver a nota no schema sobre por que ele não pode ser comprável.
ALTER TABLE "profiles" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- A listagem do painel filtra por verificados, e a busca do app vai querer
-- destacá-los. Índice parcial: a esmagadora maioria das linhas é `false`.
CREATE INDEX "profiles_verified_idx" ON "profiles"("verified") WHERE "verified" = true;
