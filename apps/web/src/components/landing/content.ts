export type Lang = 'en' | 'pt';

const content = {
  nav: {
    en: { logo: 'Quibly', cta: 'Download App', links: ['Features', 'How It Works', 'Pricing', 'FAQ'], switchLang: 'Português', switchHref: '/pt' },
    pt: { logo: 'Quibly', cta: 'Baixar App', links: ['Recursos', 'Como Funciona', 'Preços', 'FAQ'], switchLang: 'English', switchHref: '/' },
  },
  hero: {
    en: {
      badge: 'AI-Powered Study',
      title1: 'Turn PDFs into',
      titleGradient: 'Interactive Study',
      subtitle: 'Upload any PDF and AI creates flashcards with images and quizzes automatically. Study smarter with gamification, XP, and streaks.',
      ctaAppStore: 'App Store',
      ctaGooglePlay: 'Google Play',
    },
    pt: {
      badge: 'Estudo com IA',
      title1: 'Transforme PDFs em',
      titleGradient: 'Estudo Interativo',
      subtitle: 'Faça upload de qualquer PDF e a IA cria flashcards com imagens e quizzes automaticamente. Estude de forma mais inteligente com gamificação, XP e streaks.',
      ctaAppStore: 'App Store',
      ctaGooglePlay: 'Google Play',
    },
  },
  features: {
    en: {
      badge: 'Features',
      title: 'Everything you need to study smarter',
      subtitle: 'Powered by AI and designed to make studying actually fun.',
      cards: [
        { emoji: '🧠', title: 'AI Flashcards', description: 'AI reads your PDF and creates flashcards with key concepts and illustrative images automatically.' },
        { emoji: '📝', title: 'Smart Quizzes', description: 'Multiple-choice quizzes generated from your material with instant visual feedback.' },
        { emoji: '🏆', title: 'Gamification', description: 'Earn XP, maintain streaks, level up, and climb leaderboards as you study.' },
        { emoji: '📊', title: 'Progress Tracking', description: 'See your study stats, accuracy rates, and improvement trends over time.' },
      ],
    },
    pt: {
      badge: 'Recursos',
      title: 'Tudo que você precisa para estudar melhor',
      subtitle: 'Impulsionado por IA e projetado para tornar o estudo divertido.',
      cards: [
        { emoji: '🧠', title: 'Flashcards com IA', description: 'A IA lê seu PDF e cria flashcards com conceitos-chave e imagens ilustrativas automaticamente.' },
        { emoji: '📝', title: 'Quizzes Inteligentes', description: 'Quizzes de múltipla escolha gerados do seu material com feedback visual imediato.' },
        { emoji: '🏆', title: 'Gamificação', description: 'Ganhe XP, mantenha streaks, suba de nível e escale o ranking enquanto estuda.' },
        { emoji: '📊', title: 'Acompanhamento', description: 'Veja suas estatísticas de estudo, taxas de acerto e tendências de melhoria.' },
      ],
    },
  },
  howItWorks: {
    en: {
      badge: 'How It Works',
      title: '3 simple steps to start',
      subtitle: 'From PDF to interactive study in seconds.',
      steps: [
        { number: '1', title: 'Upload your PDF', description: 'Drag and drop any study material. Accepts PDFs up to 10MB.' },
        { number: '2', title: 'AI generates content', description: 'Artificial intelligence analyzes your material and creates personalized flashcards and quizzes.' },
        { number: '3', title: 'Study & earn XP', description: 'Review flashcards, take quizzes, and track progress with XP, streaks, and levels.' },
      ],
    },
    pt: {
      badge: 'Como Funciona',
      title: '3 passos simples para começar',
      subtitle: 'De PDF a estudo interativo em segundos.',
      steps: [
        { number: '1', title: 'Faça upload do PDF', description: 'Arraste e solte seu material de estudo. Aceita PDFs até 10MB.' },
        { number: '2', title: 'IA gera conteúdo', description: 'A inteligência artificial analisa seu material e cria flashcards e quizzes personalizados.' },
        { number: '3', title: 'Estude e ganhe XP', description: 'Revise flashcards, faça quizzes e acompanhe seu progresso com XP, streaks e níveis.' },
      ],
    },
  },
  comparison: {
    en: {
      badge: 'Pricing',
      title: 'Choose your plan',
      subtitle: 'Start free, upgrade anytime.',
      free: {
        title: 'Free',
        price: 'Free',
        suffix: 'forever',
        cta: 'Get Started',
        features: [
          '3 flashcard sets per day',
          '3 quizzes per day',
          'PDF upload',
          'Flashcards with images',
          'XP and streaks',
        ],
      },
      pro: {
        title: 'Pro',
        badge: 'Most Popular',
        price: '$4.99',
        suffix: '/month',
        cta: 'Go Pro',
        features: [
          'Unlimited flashcard sets',
          'Unlimited quizzes',
          'PDF upload',
          'Flashcards with images',
          'XP and streaks',
          'Priority support',
        ],
      },
    },
    pt: {
      badge: 'Preços',
      title: 'Escolha seu plano',
      subtitle: 'Comece grátis, faça upgrade quando quiser.',
      free: {
        title: 'Free',
        price: 'Grátis',
        suffix: 'para sempre',
        cta: 'Começar',
        features: [
          '3 sets de flashcards por dia',
          '3 quizzes por dia',
          'Upload de PDF',
          'Flashcards com imagens',
          'XP e streaks',
        ],
      },
      pro: {
        title: 'Pro',
        badge: 'Mais Popular',
        price: '$4.99',
        suffix: '/mês',
        cta: 'Assinar Pro',
        features: [
          'Flashcards ilimitados',
          'Quizzes ilimitados',
          'Upload de PDF',
          'Flashcards com imagens',
          'XP e streaks',
          'Suporte prioritário',
        ],
      },
    },
  },
  stats: {
    en: {
      badge: 'By the Numbers',
      title: 'Study that actually works',
      subtitle: 'Our users see real results.',
      items: [
        { value: '10K+', label: 'Flashcards Created' },
        { value: '95%', label: 'User Satisfaction' },
        { value: '2x', label: 'Faster Retention' },
        { value: '500+', label: 'PDFs Processed' },
      ],
    },
    pt: {
      badge: 'Em Números',
      title: 'Estudo que realmente funciona',
      subtitle: 'Nossos usuários veem resultados reais.',
      items: [
        { value: '10K+', label: 'Flashcards Criados' },
        { value: '95%', label: 'Satisfação' },
        { value: '2x', label: 'Retenção Mais Rápida' },
        { value: '500+', label: 'PDFs Processados' },
      ],
    },
  },
  faq: {
    en: {
      badge: 'FAQ',
      title: 'Frequently asked questions',
      items: [
        { q: 'How does the AI generate flashcards?', a: 'Our AI reads your PDF, identifies key concepts, and creates flashcards with questions, answers, and relevant images automatically.' },
        { q: 'What types of PDFs are supported?', a: 'Any text-based PDF up to 10MB — textbooks, notes, articles, slides, and more.' },
        { q: 'Is my data secure?', a: 'Yes. Your PDFs are processed securely and we never share your data with third parties.' },
        { q: 'Can I use Quibly for free?', a: 'Absolutely! The free plan includes 3 flashcard sets and 3 quizzes per day. Upgrade to Pro for unlimited access.' },
        { q: 'How does the XP system work?', a: 'You earn XP by studying flashcards and completing quizzes. Maintain daily streaks to earn bonus XP and level up.' },
        { q: 'Is there a web version?', a: 'Quibly is currently available as a mobile app for iOS and Android. A web version is on our roadmap.' },
      ],
    },
    pt: {
      badge: 'FAQ',
      title: 'Perguntas frequentes',
      items: [
        { q: 'Como a IA gera os flashcards?', a: 'Nossa IA lê seu PDF, identifica conceitos-chave e cria flashcards com perguntas, respostas e imagens relevantes automaticamente.' },
        { q: 'Quais tipos de PDF são aceitos?', a: 'Qualquer PDF baseado em texto até 10MB — livros, anotações, artigos, slides e mais.' },
        { q: 'Meus dados estão seguros?', a: 'Sim. Seus PDFs são processados com segurança e nunca compartilhamos seus dados com terceiros.' },
        { q: 'Posso usar o Quibly de graça?', a: 'Claro! O plano gratuito inclui 3 sets de flashcards e 3 quizzes por dia. Faça upgrade para Pro para acesso ilimitado.' },
        { q: 'Como funciona o sistema de XP?', a: 'Você ganha XP estudando flashcards e completando quizzes. Mantenha streaks diárias para ganhar XP bônus e subir de nível.' },
        { q: 'Existe versão web?', a: 'O Quibly está disponível atualmente como app móvel para iOS e Android. Uma versão web está em nosso roadmap.' },
      ],
    },
  },
  appDemo: {
    en: {
      badge: 'See It In Action',
      title: 'Watch Quibly work its magic',
      subtitle: 'From PDF to interactive study in seconds. Here\'s the full flow.',
      stepDescriptions: [
        'Drop any PDF and we handle the rest.',
        'AI creates cards with questions, answers, and explanations.',
        'Multiple choice quizzes with instant feedback.',
        'Track progress, maintain streaks, and level up.',
      ],
    },
    pt: {
      badge: 'Veja em Ação',
      title: 'Veja a mágica do Quibly',
      subtitle: 'De PDF a estudo interativo em segundos. Veja o fluxo completo.',
      stepDescriptions: [
        'Envie qualquer PDF e nós cuidamos do resto.',
        'A IA cria cards com perguntas, respostas e explicações.',
        'Quizzes de múltipla escolha com feedback instantâneo.',
        'Acompanhe seu progresso, mantenha streaks e suba de nível.',
      ],
    },
  },
  ctaFinal: {
    en: {
      title: 'Ready to study smarter?',
      subtitle: 'Join thousands of students already using Quibly to ace their exams.',
      ctaAppStore: 'App Store',
      ctaGooglePlay: 'Google Play',
    },
    pt: {
      title: 'Pronto para estudar melhor?',
      subtitle: 'Junte-se a milhares de estudantes que já usam o Quibly para arrasar nas provas.',
      ctaAppStore: 'App Store',
      ctaGooglePlay: 'Google Play',
    },
  },
  footer: {
    en: {
      product: { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }] },
      support: { title: 'Support', links: [{ label: 'Terms of Use', href: '/terms' }, { label: 'Privacy Policy', href: '/privacy' }] },
      social: { title: 'Social', links: [{ label: 'Twitter', href: 'https://twitter.com/quiblyapp' }, { label: 'Instagram', href: 'https://instagram.com/quiblyapp' }] },
      copyright: 'All rights reserved.',
    },
    pt: {
      product: { title: 'Produto', links: [{ label: 'Recursos', href: '#features' }, { label: 'Preços', href: '#pricing' }, { label: 'FAQ', href: '#faq' }] },
      support: { title: 'Suporte', links: [{ label: 'Termos de Uso', href: '/terms' }, { label: 'Política de Privacidade', href: '/privacy' }] },
      social: { title: 'Social', links: [{ label: 'Twitter', href: 'https://twitter.com/quiblyapp' }, { label: 'Instagram', href: 'https://instagram.com/quiblyapp' }] },
      copyright: 'Todos os direitos reservados.',
    },
  },
} as const;

export default content;
