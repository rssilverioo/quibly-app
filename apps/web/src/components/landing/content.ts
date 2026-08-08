export type Lang = 'en' | 'pt';

/**
 * O texto da página.
 *
 * ## O que saiu, e por quê
 *
 * A versão anterior vendia outro produto: "Transforme PDFs em Estudo
 * Interativo", com flashcards por IA e quizzes como as quatro features. Isso
 * era verdade em alguma fase do projeto e deixou de ser — quem chegasse pelo
 * site baixaria esperando um app de flashcards e abriria um app de salas de
 * estudo.
 *
 * Saiu também a seção de números: "10K+ Flashcards Criados", "95% de
 * Satisfação", "2x Retenção Mais Rápida", sob o título "Nossos usuários veem
 * resultados reais". **O app não lançou.** Alegação de eficácia sem base não é
 * só constrangedora: é motivo de reprovação na App Store e problema de
 * propaganda enganosa. Antes de ter usuários, número honesto não existe — e a
 * ausência dele é o que fez esta página ter que ser interessante por outros
 * meios.
 *
 * ## A régua para o que fica
 *
 * Toda frase aqui descreve algo que o app **faz hoje**. Nada de "em breve"
 * escrito como presente, nada de recurso que existe no roadmap.
 */
export const conteudo = {
  nav: {
    en: { recursos: 'How it works', porque: 'Why days', plano: 'Pricing', baixar: 'Get the app' },
    pt: { recursos: 'Como funciona', porque: 'Por que dias', plano: 'Planos', baixar: 'Baixar o app' },
  },

  hero: {
    en: {
      etiqueta: 'Study rooms',
      titulo: 'Studying alone is easy to quit.',
      tituloDestaque: 'Being seen is not.',
      texto:
        'Create a room, bring the people you study with, and start a challenge. Every session counts, every check-in shows up in the feed, and the ranking counts the days you turned up — not the one night you crammed.',
      cta: 'Get the app',
      ctaSegundo: 'See how it works',
      legenda: 'Six months of showing up. One square per day.',
    },
    pt: {
      etiqueta: 'Salas de estudo',
      titulo: 'Estudar sozinho é fácil de largar.',
      tituloDestaque: 'Ser visto, não.',
      texto:
        'Crie uma sala, chame quem estuda com você e comecem um desafio. Cada sessão conta, cada check-in aparece no feed, e o ranking conta os dias em que você apareceu — não a noite em que você virou.',
      cta: 'Baixar o app',
      ctaSegundo: 'Ver como funciona',
      legenda: 'Seis meses de presença. Um quadrado por dia.',
    },
  },

  cronometro: {
    en: {
      etiqueta: 'The timer',
      titulo: 'Close the app. The clock keeps going.',
      texto:
        'Time is measured on the server, not on your phone. Take a call, put it face down, let the battery die — the session survives. On iPhone it stays on the lock screen and in the Dynamic Island, with pause and finish right there.',
      pontos: [
        'Counted on the server, so nothing depends on the app staying open',
        'Live on the lock screen and in the Dynamic Island',
        'If the connection drops, the session is credited up to the last beat',
      ],
    },
    pt: {
      etiqueta: 'O cronômetro',
      titulo: 'Feche o app. O relógio continua.',
      texto:
        'O tempo é medido no servidor, não no seu celular. Atenda o telefone, vire a tela para baixo, deixe a bateria acabar — a sessão sobrevive. No iPhone ela fica na tela de bloqueio e na Dynamic Island, com pausar e encerrar ali mesmo.',
      pontos: [
        'Contado no servidor, então nada depende de o app ficar aberto',
        'Ao vivo na tela de bloqueio e na Dynamic Island',
        'Se a conexão cair, a sessão é creditada até a última batida',
      ],
    },
  },

  dias: {
    en: {
      etiqueta: 'Why days',
      titulo: 'Consistency beats records.',
      texto:
        'The ranking counts days you showed up, with minutes only as a tiebreaker. One all-nighter does not win a challenge, and one light day does not erase your streak. It rewards the thing that actually gets people through an exam: coming back tomorrow.',
    },
    pt: {
      etiqueta: 'Por que dias',
      titulo: 'Constância ganha de recorde.',
      texto:
        'O ranking conta dias em que você apareceu, e os minutos só desempatam. Virar uma noite não ganha desafio, e um dia leve não apaga sua sequência. Ele premia o que de fato tira alguém de uma prova: voltar amanhã.',
    },
  },

  passos: {
    en: {
      etiqueta: 'Getting started',
      titulo: 'Three steps, one afternoon.',
      itens: [
        { titulo: 'Create the room', texto: 'Name it, pick a deadline, set the cover. Sixty seconds.' },
        { titulo: 'Send the link', texto: 'Anyone with the link joins. No accounts to hand out.' },
        { titulo: 'Start studying', texto: 'Hit the timer or post a check-in photo. Both count as showing up.' },
      ],
    },
    pt: {
      etiqueta: 'Como começa',
      titulo: 'Três passos, uma tarde.',
      itens: [
        { titulo: 'Crie a sala', texto: 'Dê um nome, escolha o prazo, ponha uma capa. Sessenta segundos.' },
        { titulo: 'Mande o link', texto: 'Quem tem o link entra. Sem distribuir conta para ninguém.' },
        { titulo: 'Comece a estudar', texto: 'Toque o cronômetro ou poste uma foto de check-in. Os dois contam presença.' },
      ],
    },
  },

  plano: {
    en: {
      etiqueta: 'Pricing',
      titulo: 'Free for three rooms of your own.',
      texto:
        'Joining other people’s rooms is always unlimited — an invitation should never depend on someone’s plan. The paid plan lifts the limit on rooms you create.',
      nota: 'Quibly Pro is coming soon.',
    },
    pt: {
      etiqueta: 'Planos',
      titulo: 'Grátis para três salas suas.',
      texto:
        'Participar das salas dos outros é sempre ilimitado — um convite nunca deveria depender do plano de ninguém. O plano pago tira o limite das salas que você cria.',
      nota: 'O Quibly Pro chega em breve.',
    },
  },

  fim: {
    en: {
      titulo: 'Tomorrow is the one that counts.',
      texto: 'Free to start. Nothing to set up.',
      cta: 'Get the app',
      loja: 'Also coming to Android',
    },
    pt: {
      titulo: 'Amanhã é o que conta.',
      texto: 'Comece de graça. Nada para configurar.',
      cta: 'Baixar o app',
      loja: 'Em breve no Android',
    },
  },

  rodape: {
    en: { direitos: 'Quibly', privacidade: 'Privacy', termos: 'Terms', apagar: 'Delete account' },
    pt: { direitos: 'Quibly', privacidade: 'Privacidade', termos: 'Termos', apagar: 'Excluir conta' },
  },
} as const;
