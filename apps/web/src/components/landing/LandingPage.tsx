'use client';

import Image from 'next/image';
import { ArrowDown, Camera, Download, Link2, Lock, Server, Timer, WifiOff } from 'lucide-react';

import IconeApp from './IconeApp';
import CoelhoImagem from './CoelhoImagem';
import BotoesDeLoja, { APP_STORE } from './BotoesDeLoja';
import MapaDeConstancia from './MapaDeConstancia';
import MockDoApp from './MockDoApp';
import { Aparece, Desce, Escalonado, Flutua, Item } from './Movimento';
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
      <Desce className="nav">
        <a className="nav-marca" href="#topo">
          <IconeApp size={34} />
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
      </Desce>

      {/* ── herói ─────────────────────────────────────────────────────────── */}
      <section className="hero" id="topo">
        <Escalonado className="hero-texto" intervalo={0.11}>
          <Item como="span" className="etiqueta">{hero.etiqueta}</Item>
          <Item>
            <h1 className="display">
              {hero.titulo}
              <br />
              <em>{hero.tituloDestaque}</em>
            </h1>
          </Item>
          <Item como="div"><p className="lead">{hero.texto}</p></Item>
          <Item><BotoesDeLoja apple={lojas.appStore} google={lojas.playStore} /></Item>
          <Item className="hero-acoes">
            <a className="btn btn-fantasma" href="#cronometro">
              {hero.ctaSegundo}
              <ArrowDown size={16} aria-hidden="true" />
            </a>
          </Item>
        </Escalonado>

        {/*
          O coelho mostrando o celular, e não uma captura de tela.

          As capturas em `public/app/` são do app **antigo**: tema escuro, em
          inglês, com telas que não existem mais. Uma landing em português com
          um app claro não pode abrir com um telefone preto escrito "Your
          rooms". Quando as capturas do app novo chegarem, o `Fone` volta aqui.
        */}
        <Flutua className="hero-arte">
          <MockDoApp size={560} prioridade />
        </Flutua>

        <Aparece como="figure" className="hero-mapa" atraso={0.2}>
          <MapaDeConstancia />
          <figcaption>{hero.legenda}</figcaption>
        </Aparece>
      </section>

      <Semana />

      {/* ── o cronômetro ──────────────────────────────────────────────────── */}
      <section className="secao secao-escura" id="cronometro">
        <div className="secao-par">
          <Aparece>
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
          </Aparece>
          <Aparece className="secao-arte" atraso={0.15} escala={0.9}>
            <CoelhoImagem nome="focused" alt="O coelho estudando concentrado, de fones" size={260} />
          </Aparece>
        </div>
      </section>

      {/* ── por que dias ──────────────────────────────────────────────────── */}
      <section className="secao" id="dias">
        <div className="secao-par">
          <Aparece className="secao-arte" escala={0.9}>
            <CoelhoImagem nome="correndo-faixa" alt="O coelho correndo, de faixa na cabeça" size={300} />
          </Aparece>
          <Aparece atraso={0.15}>
            <span className="etiqueta">{dias.etiqueta}</span>
            <h2 className="display display-medio">{dias.titulo}</h2>
            <p className="lead">{dias.texto}</p>
          </Aparece>
        </div>
      </section>

      <Semana />

      {/* ── como começa ───────────────────────────────────────────────────── */}
      <section className="secao">
        <Aparece>
          <span className="etiqueta">{passos.etiqueta}</span>
          <h2 className="display display-medio centro">{passos.titulo}</h2>
        </Aparece>
        {/*
          Numeração aqui é honesta: são passos numa ordem, e a ordem é
          informação — não dá para mandar o link de uma sala que não existe.
        */}
        <Escalonado como="ol" className="passos" intervalo={0.14}>
          {passos.itens.map((item, i) => {
            const Icone = ICONES_PASSOS[i];
            return (
            <Item como="li" key={item.titulo} levanta>
              <span className="passo-topo">
                <span className="passo-icone" aria-hidden="true"><Icone size={20} /></span>
                <span className="passo-numero mono">{String(i + 1).padStart(2, '0')}</span>
              </span>
              <h3>{item.titulo}</h3>
              <p>{item.texto}</p>
            </Item>
            );
          })}
        </Escalonado>
      </section>

      {/* ── plano ─────────────────────────────────────────────────────────── */}
      <section className="secao secao-plano" id="plano">
        <Aparece escala={0.85}>
          <CoelhoImagem nome="celebrate" alt="O coelho comemorando" size={150} />
        </Aparece>
        <Aparece className="secao-plano-texto" atraso={0.1}>
          <span className="etiqueta">{plano.etiqueta}</span>
          <h2 className="display display-medio centro">{plano.titulo}</h2>
          <p className="lead centro">{plano.texto}</p>
        </Aparece>
        {/*
          Dois cartões, e só o que o app aplica de verdade: cada linha do Pro
          tem um gate no servidor ou no app (`docs/LOJAS.md §Pro`). O preço é o
          da loja brasileira; a compra acontece no app, então aqui não há botão
          de assinar — há o de baixar.
        */}
        <Escalonado className="planos" intervalo={0.16}>
          <Item className="plano-cartao" levanta>
            <span className="plano-nome">{plano.gratis.nome}</span>
            <span className="plano-preco">{plano.gratis.preco}</span>
            <ul className="lista lista-plano">
              {plano.gratis.itens.map((item) => (
                <li key={item}><span className="marca-dia" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </Item>
          <Item className="plano-cartao plano-cartao-pro" levanta>
            <span className="plano-nome">{plano.pro.nome}</span>
            <span className="plano-preco">{plano.pro.preco}<small>{plano.pro.periodo}</small></span>
            <span className="plano-anual">{plano.pro.anual}</span>
            <ul className="lista lista-plano">
              {plano.pro.itens.map((item) => (
                <li key={item}><span className="marca-dia" aria-hidden="true" />{item}</li>
              ))}
            </ul>
            <a className="btn btn-primario" href={APP_STORE}>{hero.cta}</a>
          </Item>
        </Escalonado>
        <Aparece como="p" className="nota">{plano.nota}</Aparece>
      </section>

      <Semana />

      {/* ── fim ───────────────────────────────────────────────────────────── */}
      <section className="secao secao-fim">
        <Escalonado className="secao-fim-miolo" intervalo={0.12}>
          <Item><h2 className="display centro">{fim.titulo}</h2></Item>
          <Item><p className="lead centro">{fim.texto}</p></Item>
          <Item><BotoesDeLoja apple={lojas.appStore} google={lojas.playStore} centro /></Item>
          <Item><p className="nota">{fim.loja}</p></Item>
        </Escalonado>
      </section>

      <footer className="rodape">
        <div className="rodape-marca">
          <IconeApp size={28} />
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
