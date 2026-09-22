'use client';

import Image from 'next/image';
import { ArrowDown, Camera, Download, Link2, Lock, Server, Timer, WifiOff } from 'lucide-react';

import Coelho from './Coelho';
import CoelhoImagem from './CoelhoImagem';
import BotoesDeLoja, { APP_STORE } from './BotoesDeLoja';
import MapaDeConstancia from './MapaDeConstancia';
import { conteudo, type Lang } from './content';

/**
 * A landing page.
 *
 * ## A tese
 *
 * O herói é o **mapa de constância**, não uma frase sobre produtividade. Ele é
 * o artefato mais nosso que existe — uma célula por dia, sete linhas porque a
 * semana tem sete — e diz "constância" antes de qualquer texto ser lido.
 *
 * ## O ritmo de sete
 *
 * A página inteira anda numa grade de sete colunas, e os separadores de seção
 * são uma fileira de sete células. Não é ornamento: sete é a semana, que é a
 * unidade que o produto mede. Um separador de três ou de cinco não diria nada.
 *
 * ## Onde a ousadia foi gasta
 *
 * No mapa e no ritmo de sete. Todo o resto é disciplinado de propósito —
 * tipografia clara, seções largas, uma cor de acento só. Gastar ousadia em dois
 * lugares faz os dois brigarem.
 */
export default function LandingPage({ lang }: { lang: Lang }) {
  const t = <K extends keyof typeof conteudo>(k: K) => conteudo[k][lang] as (typeof conteudo)[K]['pt'];

  const nav = t('nav');
  const hero = t('hero');
  const cron = t('cronometro');
  const dias = t('dias');
  const passos = t('passos');
  const plano = t('plano');
  const fim = t('fim');
  const rodape = t('rodape');

  const lojas = conteudo.download[lang];

  return (
    <div className="pagina">
      <header className="nav">
        <a className="nav-marca" href="#topo">
          <Coelho size={34} />
          <span>Quibly</span>
        </a>
        <nav className="nav-links">
          <a href="#cronometro">{nav.recursos}</a>
          <a href="#dias">{nav.porque}</a>
          <a href="#plano">{nav.plano}</a>
        </nav>
        <a className="btn btn-primario btn-pequeno" href={APP_STORE}>
          <Download size={16} aria-hidden="true" />
          {nav.baixar}
        </a>
      </header>

      {/* ── herói ─────────────────────────────────────────────────────────── */}
      <section className="hero" id="topo">
        <div className="hero-texto">
          <span className="etiqueta">{hero.etiqueta}</span>
          <h1 className="display">
            {hero.titulo}
            <br />
            <em>{hero.tituloDestaque}</em>
          </h1>
          <p className="lead">{hero.texto}</p>
          <BotoesDeLoja apple={lojas.appStore} google={lojas.playStore} />
          <div className="hero-acoes">
            <a className="btn btn-fantasma" href="#cronometro">
              {hero.ctaSegundo}
              <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        {/*
          O coelho mostrando o celular, e não uma captura de tela.

          As capturas em `public/app/` são do app **antigo**: tema escuro, em
          inglês, com telas que não existem mais. Uma landing em português com
          um app claro não pode abrir com um telefone preto escrito "Your
          rooms". Quando as capturas do app novo chegarem, o `Fone` volta aqui.
        */}
        <div className="hero-arte">
          <CoelhoImagem nome="celular-quibly" alt="O coelho do Quibly mostrando o app no celular" size={360} prioridade />
        </div>

        <figure className="hero-mapa">
          <MapaDeConstancia />
          <figcaption>{hero.legenda}</figcaption>
        </figure>
      </section>

      <Semana />

      {/* ── o cronômetro ──────────────────────────────────────────────────── */}
      <section className="secao secao-escura" id="cronometro">
        <div className="secao-par">
          <div>
            <span className="etiqueta etiqueta-clara">{cron.etiqueta}</span>
            <h2 className="display display-medio">{cron.titulo}</h2>
            <p className="lead lead-claro">{cron.texto}</p>
            <ul className="lista">
              {cron.pontos.map((p, i) => {
                const Icone = ICONES_CRONOMETRO[i];
                return (
                  <li key={p}>
                    <span className="lista-icone" aria-hidden="true"><Icone size={18} /></span>
                    {p}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="secao-arte">
            <CoelhoImagem nome="focused" alt="O coelho estudando concentrado, de fones" size={260} />
          </div>
        </div>
      </section>

      {/* ── por que dias ──────────────────────────────────────────────────── */}
      <section className="secao" id="dias">
        <div className="secao-par">
          <div className="secao-arte">
            <CoelhoImagem nome="correndo-faixa" alt="O coelho correndo, de faixa na cabeça" size={300} />
          </div>
          <div>
            <span className="etiqueta">{dias.etiqueta}</span>
            <h2 className="display display-medio">{dias.titulo}</h2>
            <p className="lead">{dias.texto}</p>

          </div>
        </div>
      </section>

      <Semana />

      {/* ── como começa ───────────────────────────────────────────────────── */}
      <section className="secao">
        <span className="etiqueta">{passos.etiqueta}</span>
        <h2 className="display display-medio centro">{passos.titulo}</h2>
        {/*
          Numeração aqui é honesta: são passos numa ordem, e a ordem é
          informação — não dá para mandar o link de uma sala que não existe.
        */}
        <ol className="passos">
          {passos.itens.map((item, i) => {
            const Icone = ICONES_PASSOS[i];
            return (
            <li key={item.titulo}>
              <span className="passo-topo">
                <span className="passo-icone" aria-hidden="true"><Icone size={20} /></span>
                <span className="passo-numero mono">{String(i + 1).padStart(2, '0')}</span>
              </span>
              <h3>{item.titulo}</h3>
              <p>{item.texto}</p>
            </li>
            );
          })}
        </ol>
      </section>

      {/* ── plano ─────────────────────────────────────────────────────────── */}
      <section className="secao secao-plano" id="plano">
        <CoelhoImagem nome="celebrate" alt="O coelho comemorando" size={150} />
        <span className="etiqueta">{plano.etiqueta}</span>
        <h2 className="display display-medio centro">{plano.titulo}</h2>
        <p className="lead centro">{plano.texto}</p>
        {/*
          Dois cartões, e só o que o app aplica de verdade: cada linha do Pro
          tem um gate no servidor ou no app (`docs/LOJAS.md §Pro`). O preço é o
          da loja brasileira; a compra acontece no app, então aqui não há botão
          de assinar — há o de baixar.
        */}
        <div className="planos">
          <div className="plano-cartao">
            <span className="plano-nome">{plano.gratis.nome}</span>
            <span className="plano-preco">{plano.gratis.preco}</span>
            <ul className="lista lista-plano">
              {plano.gratis.itens.map((item) => (
                <li key={item}><span className="marca-dia" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>
          <div className="plano-cartao plano-cartao-pro">
            <span className="plano-nome">{plano.pro.nome}</span>
            <span className="plano-preco">{plano.pro.preco}<small>{plano.pro.periodo}</small></span>
            <span className="plano-anual">{plano.pro.anual}</span>
            <ul className="lista lista-plano">
              {plano.pro.itens.map((item) => (
                <li key={item}><span className="marca-dia" aria-hidden="true" />{item}</li>
              ))}
            </ul>
            <a className="btn btn-primario" href={APP_STORE}>{hero.cta}</a>
          </div>
        </div>
        <p className="nota">{plano.nota}</p>
      </section>

      <Semana />

      {/* ── fim ───────────────────────────────────────────────────────────── */}
      <section className="secao secao-fim">
        <h2 className="display centro">{fim.titulo}</h2>
        <p className="lead centro">{fim.texto}</p>
        <BotoesDeLoja apple={lojas.appStore} google={lojas.playStore} centro />
        <p className="nota">{fim.loja}</p>
      </section>

      <footer className="rodape">
        <div className="rodape-marca">
          <Coelho size={28} />
          <span>{rodape.direitos} © {new Date().getFullYear()}</span>
        </div>
        <nav>
          <a href="/privacy">{rodape.privacidade}</a>
          <a href="/terms">{rodape.termos}</a>
          <a href="/delete-account">{rodape.apagar}</a>
        </nav>
      </footer>
    </div>
  );
}

/**
 * Ícones do Lucide, na ordem dos textos em `content.ts`.
 *
 * Os três pontos do cronômetro: servidor, tela de bloqueio, conexão caída.
 * Os três passos: criar a sala, mandar o link, estudar (cronômetro + foto).
 * Se um texto mudar de ordem lá, a ordem aqui muda junto.
 */
const ICONES_CRONOMETRO = [Server, Lock, WifiOff];
const ICONES_PASSOS = [Timer, Link2, Camera];

/**
 * O separador: sete células, uma semana.
 *
 * Substituiu a linha fina que estava aqui. Uma régua horizontal separa duas
 * seções e não diz nada; sete quadrados dizem qual é a unidade de tempo do
 * produto, no mesmo espaço.
 */
function Semana() {
  return (
    <div className="semana" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} style={{ opacity: 0.25 + i * 0.11 }} />
      ))}
    </div>
  );
}

/**
 * O aparelho.
 *
 * Desenhado em CSS e não uma imagem de moldura: a moldura em PNG obriga a
 * acertar o recorte por cima em pixel, e quebra em qualquer tela que não seja a
 * que ela foi feita. Em CSS a tela do app é uma `<Image>` do Next, que serve
 * tamanho certo por dispositivo.
 */
function Fone({ src, alt, prioridade }: { src: string; alt: string; prioridade?: boolean }) {
  return (
    <div className="fone">
      <div className="fone-tela">
        <Image src={src} alt={alt} width={450} height={906} priority={prioridade} />
      </div>
      <span className="fone-ilha" aria-hidden="true" />
    </div>
  );
}
