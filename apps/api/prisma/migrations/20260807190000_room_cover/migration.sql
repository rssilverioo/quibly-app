-- A capa da sala.
--
-- Até aqui o app lia `cover_url` de toda sala, recebia `undefined` e caía no
-- desenho gerado a partir do id — por isso **toda** sala mostrava o coelho
-- padrão. Não era escolha de design: a coluna nunca existiu.
--
-- Nullable de propósito: sala sem capa continua caindo no desenho gerado, que
-- é um padrão bom e não uma ausência. Obrigar uma capa na criação poria uma
-- escolha entre o usuário e a sala que ele quer criar agora.
ALTER TABLE "leagues" ADD COLUMN "cover_url" TEXT;
