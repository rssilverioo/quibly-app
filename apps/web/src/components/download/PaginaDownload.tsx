'use client';

import { ArrowRight, Timer, Users, Flame } from 'lucide-react';

import BotoesDeLoja from '../landing/BotoesDeLoja';
import Coelho from '../landing/Coelho';
import CoelhoImagem from '../landing/CoelhoImagem';
import { Escalonado, Flutua, Item } from '../landing/Movimento';
import { conteudo, type Lang } from '../landing/content';

/**
 * A página que `/download` mostra a quem não foi redirecionado — computador,
 * tablet, e o robô que monta a prévia do link.
 *
 * Era um cartão de convite reaproveitado. Virou uma página própria: o coelho
 * com o celular, o título com a promessa do produto, os dois botões de loja
 * lado a lado e três razões curtas. Mesmo material da landing (paleta, faces,
 * a fileira de sete) para quem chega da bio do Instagram reconhecer o site.
 */
const ICONES = [Timer, Users, Flame];

export default function PaginaDownload({ lang }: { lang: Lang }) {
  const t = conteudo.download[lang];

  return (
    <main className="pagina baixar">
      <a className="baixar-marca" href="/">
        <Coelho size={30} />
        <span>Quibly</span>
      </a>

      <section className="baixar-heroi">
        <Flutua className="baixar-arte">
          <CoelhoImagem nome="celular-quibly" alt="O coelho do Quibly mostrando o app no celular" size={320} prioridade />
        </Flutua>

        <Escalonado className="baixar-texto" intervalo={0.11}>
          <Item como="span" className="etiqueta">{t.etiqueta}</Item>
          <Item>
            <h1 className="display">
              {t.titulo}
              <br />
              <em>{t.tituloDestaque}</em>
            </h1>
          </Item>
          <Item><p className="lead">{t.descricao}</p></Item>
          <Item><BotoesDeLoja apple={t.appStore} google={t.playStore} /></Item>
          <Item>
            <a className="baixar-site" href="/">
              {t.site}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </Item>
        </Escalonado>
      </section>

      <div className="semana" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} style={{ opacity: 0.25 + i * 0.11 }} />
        ))}
      </div>

      <Escalonado como="ul" className="baixar-pontos" intervalo={0.12}>
        {t.pontos.map((ponto, i) => {
          const Icone = ICONES[i];
          return (
            <Item como="li" key={ponto.titulo} levanta>
              <span className="passo-icone" aria-hidden="true"><Icone size={20} /></span>
              <h2>{ponto.titulo}</h2>
              <p>{ponto.texto}</p>
            </Item>
          );
        })}
      </Escalonado>
    </main>
  );
}
