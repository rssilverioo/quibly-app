/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Monta em `.next/standalone` um servidor com só as dependências que o site
   * realmente usa, rastreadas a partir dos imports.
   *
   * Sem isto, servir o site num contêiner exigiria arrastar o `node_modules`
   * do monorepo inteiro para dentro da imagem — que inclui o Prisma, o NestJS e
   * tudo que a API precisa e o site nunca importa.
   *
   * A Vercel dispensava isso porque montava o runtime dela. Fora dela, quem
   * monta somos nós. Ver `Dockerfile`.
   */
  output: 'standalone',
  /**
   * A raiz é o monorepo, não `apps/web`.
   *
   * O rastreador de arquivos do Next sobe a árvore procurando um lockfile para
   * decidir o que copiar. Achando o `package-lock.json` da raiz ele acerta;
   * sem a dica explícita ele avisa que há mais de uma raiz possível e pode
   * escolher a errada, deixando de fora o `packages/shared`.
   */
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default nextConfig;
