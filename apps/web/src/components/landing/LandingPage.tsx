'use client';

import Image from 'next/image';

import Coelho from './Coelho';
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

  const APP_STORE = 'https://apps.apple.com/app/id6760320166';

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
        <a className="btn btn-primario btn-pequeno" href={APP_STORE}>{nav.baixar}</a>
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
          <div className="hero-acoes">
            <a className="btn btn-primario" href={APP_STORE}>{hero.cta}</a>
            <a className="btn btn-fantasma" href="#cronometro">{hero.ctaSegundo}</a>
          </div>
        </div>

        <div className="hero-fone">
          <Fone src="/app/salas.png" alt="Lista de salas no Quibly" prioridade />
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
              {cron.pontos.map((p) => (
                <li key={p}>
                  <span className="marca-dia" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="secao-arte">
            <Coelho estado="foco" size={190} />
          </div>
        </div>
      </section>

      {/* ── por que dias ──────────────────────────────────────────────────── */}
      <section className="secao" id="dias">
        <div className="secao-par">
          <div className="secao-arte">
            <Fone src="/app/perfil.png" alt="Perfil com o mapa de constância" />
          </div>
          <div>
            <span className="etiqueta">{dias.etiqueta}</span>
            <h2 className="display display-medio">{dias.titulo}</h2>
            <p className="lead">{dias.texto}</p>
            <div className="coelho-linha">
              <Coelho estado="trofeu" size={96} />
              <Coelho estado="lendo" size={78} />
              <Coelho estado="idle" size={66} />
            </div>
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
          {passos.itens.map((item, i) => (
            <li key={item.titulo}>
              <span className="passo-numero mono">{String(i + 1).padStart(2, '0')}</span>
              <h3>{item.titulo}</h3>
              <p>{item.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── plano ─────────────────────────────────────────────────────────── */}
      <section className="secao secao-plano" id="plano">
        <Coelho estado="coroado" size={130} />
        <span className="etiqueta">{plano.etiqueta}</span>
        <h2 className="display display-medio centro">{plano.titulo}</h2>
        <p className="lead centro">{plano.texto}</p>
        <p className="nota mono">{plano.nota}</p>
      </section>

      <Semana />

      {/* ── fim ───────────────────────────────────────────────────────────── */}
      <section className="secao secao-fim">
        <h2 className="display centro">{fim.titulo}</h2>
        <p className="lead centro">{fim.texto}</p>
        <a className="btn btn-primario btn-grande" href={APP_STORE}>{fim.cta}</a>
        {/* "Em breve no Android" como texto, e não como botão morto: um botão
            que não leva a lugar nenhum é a promessa mais barata que existe. */}
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
