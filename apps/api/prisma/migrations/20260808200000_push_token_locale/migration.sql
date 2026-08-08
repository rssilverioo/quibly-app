-- O idioma do aparelho, para a notificação chegar na língua do celular.
-- Nulo nos tokens que já existem: eles caem no padrão em vez de quebrar.
ALTER TABLE "push_tokens" ADD COLUMN "locale" TEXT;
