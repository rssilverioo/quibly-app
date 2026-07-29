import type { CountrySeed } from './types';

/**
 * Brasil — ENEM, OAB e Concursos.
 *
 * ## ⚠️ Sobre os pesos — leia antes de confiar neles
 *
 * Os números de `weight` e `frequency` abaixo são uma **primeira estimativa
 * estruturada**, não uma tabulação de itens de prova. Eles refletem a
 * distribuição amplamente conhecida das provas (as 4 áreas do ENEM têm 45
 * questões cada, a incidência relativa dos conteúdos é pública e discutida em
 * todo cursinho), mas **ninguém contou item por item para produzir esta
 * tabela**.
 *
 * Isso importa porque na Fase 6 estes números entram direto no gerador de
 * plano: `peso × (1 − domínio) × urgência`. Um peso errado não causa bug — ele
 * manda a pessoa estudar a coisa errada, silenciosamente, por meses.
 *
 * **Antes de a Fase 6 começar, um professor ou coordenador pedagógico precisa
 * revisar esta tabela.** O prompt da tarefa é explícito: "não gere o currículo
 * inteiro com LLM sem revisão humana". Este arquivo é a estrutura, com números
 * plausíveis para destravar o produto — não é a palavra final.
 *
 * A estrutura em si (áreas, disciplinas, quais tópicos existem) é sólida e
 * segue a matriz de referência do ENEM. É nos *números* que mora a incerteza.
 */
export const brazil: CountrySeed = {
  code: 'BR',
  nameEn: 'Brazil',
  namePt: 'Brasil',
  locale: 'pt-BR',
  weightSource:
    'Estimativa estruturada a partir da matriz de referência do ENEM e da ' +
    'incidência historicamente reportada de conteúdos. PENDENTE de revisão ' +
    'pedagógica antes da Fase 6 — ver cabeçalho de prisma/seeds/br.ts.',

  tracks: [
    {
      slug: 'enem',
      name: 'ENEM',
      description:
        'Exame Nacional do Ensino Médio. Quatro áreas de 45 questões mais a redação.',
      disciplines: [
        {
          slug: 'matematica',
          name: 'Matemática e suas Tecnologias',
          color: '#4D9FFF',
          topics: [
            { slug: 'razao-proporcao', name: 'Razão, proporção e regra de três', weight: 85, frequency: 10 },
            { slug: 'porcentagem', name: 'Porcentagem e juros', weight: 80, frequency: 10 },
            { slug: 'estatistica', name: 'Estatística: média, mediana e moda', weight: 78, frequency: 10 },
            { slug: 'leitura-graficos', name: 'Leitura e interpretação de gráficos', weight: 82, frequency: 10 },
            { slug: 'geometria-plana', name: 'Geometria plana: áreas e perímetros', weight: 75, frequency: 9 },
            { slug: 'geometria-espacial', name: 'Geometria espacial: volumes', weight: 70, frequency: 9 },
            { slug: 'funcoes-1grau', name: 'Função do 1º grau', weight: 65, frequency: 8 },
            { slug: 'funcoes-2grau', name: 'Função do 2º grau', weight: 62, frequency: 8 },
            { slug: 'funcao-exponencial', name: 'Função exponencial e logaritmo', weight: 55, frequency: 7 },
            { slug: 'probabilidade', name: 'Probabilidade', weight: 60, frequency: 8 },
            { slug: 'analise-combinatoria', name: 'Análise combinatória', weight: 52, frequency: 7 },
            { slug: 'progressoes', name: 'Progressões aritmética e geométrica', weight: 45, frequency: 6 },
            { slug: 'trigonometria', name: 'Trigonometria', weight: 40, frequency: 5 },
            { slug: 'geometria-analitica', name: 'Geometria analítica', weight: 38, frequency: 5 },
            { slug: 'matrizes-sistemas', name: 'Matrizes e sistemas lineares', weight: 30, frequency: 4 },
          ],
        },
        {
          slug: 'linguagens',
          name: 'Linguagens, Códigos e suas Tecnologias',
          color: '#FF8A4D',
          topics: [
            { slug: 'interpretacao-texto', name: 'Interpretação de texto', weight: 92, frequency: 10 },
            { slug: 'generos-textuais', name: 'Gêneros textuais', weight: 78, frequency: 10 },
            { slug: 'figuras-linguagem', name: 'Figuras de linguagem', weight: 70, frequency: 9 },
            { slug: 'variacao-linguistica', name: 'Variação linguística', weight: 72, frequency: 9 },
            { slug: 'funcoes-linguagem', name: 'Funções da linguagem', weight: 65, frequency: 9 },
            { slug: 'literatura-modernismo', name: 'Modernismo brasileiro', weight: 62, frequency: 8 },
            { slug: 'literatura-realismo', name: 'Realismo e Naturalismo', weight: 50, frequency: 7 },
            { slug: 'literatura-romantismo', name: 'Romantismo', weight: 48, frequency: 7 },
            { slug: 'gramatica-coesao', name: 'Coesão e coerência', weight: 68, frequency: 9 },
            { slug: 'ingles', name: 'Inglês', weight: 55, frequency: 10 },
            { slug: 'espanhol', name: 'Espanhol', weight: 55, frequency: 10 },
            { slug: 'artes', name: 'Artes e movimentos artísticos', weight: 42, frequency: 7 },
            { slug: 'educacao-fisica', name: 'Educação Física', weight: 35, frequency: 6 },
            { slug: 'tecnologias-informacao', name: 'Tecnologias da informação', weight: 38, frequency: 6 },
          ],
        },
        {
          slug: 'redacao',
          name: 'Redação',
          color: '#C8FF4D',
          topics: [
            { slug: 'competencia-1', name: 'C1 — Domínio da norma culta', weight: 100, frequency: 10 },
            { slug: 'competencia-2', name: 'C2 — Compreender o tema e o tipo dissertativo-argumentativo', weight: 100, frequency: 10 },
            { slug: 'competencia-3', name: 'C3 — Selecionar e organizar argumentos', weight: 100, frequency: 10 },
            { slug: 'competencia-4', name: 'C4 — Coesão e mecanismos linguísticos', weight: 100, frequency: 10 },
            { slug: 'competencia-5', name: 'C5 — Proposta de intervenção', weight: 100, frequency: 10 },
            { slug: 'repertorio', name: 'Repertório sociocultural', weight: 88, frequency: 10 },
            { slug: 'estrutura-dissertativa', name: 'Estrutura do texto dissertativo', weight: 90, frequency: 10 },
          ],
        },
        {
          slug: 'ciencias-natureza',
          name: 'Ciências da Natureza e suas Tecnologias',
          color: '#4ADE80',
          topics: [
            { slug: 'ecologia', name: 'Ecologia e meio ambiente', weight: 85, frequency: 10 },
            { slug: 'citologia', name: 'Citologia', weight: 72, frequency: 9 },
            { slug: 'genetica', name: 'Genética', weight: 75, frequency: 9 },
            { slug: 'fisiologia-humana', name: 'Fisiologia humana', weight: 68, frequency: 9 },
            { slug: 'evolucao', name: 'Evolução', weight: 58, frequency: 8 },
            { slug: 'quimica-organica', name: 'Química orgânica', weight: 70, frequency: 9 },
            { slug: 'estequiometria', name: 'Estequiometria', weight: 72, frequency: 9 },
            { slug: 'solucoes', name: 'Soluções e concentração', weight: 65, frequency: 9 },
            { slug: 'eletroquimica', name: 'Eletroquímica', weight: 55, frequency: 7 },
            { slug: 'termoquimica', name: 'Termoquímica', weight: 52, frequency: 7 },
            { slug: 'mecanica', name: 'Mecânica: cinemática e dinâmica', weight: 75, frequency: 9 },
            { slug: 'energia-trabalho', name: 'Trabalho, energia e potência', weight: 72, frequency: 9 },
            { slug: 'eletricidade', name: 'Eletricidade e circuitos', weight: 70, frequency: 9 },
            { slug: 'ondulatoria', name: 'Ondulatória e acústica', weight: 55, frequency: 8 },
            { slug: 'termologia', name: 'Termologia', weight: 58, frequency: 8 },
            { slug: 'optica', name: 'Óptica', weight: 48, frequency: 7 },
          ],
        },
        {
          slug: 'ciencias-humanas',
          name: 'Ciências Humanas e suas Tecnologias',
          color: '#FBBF24',
          topics: [
            { slug: 'brasil-republica', name: 'Brasil República', weight: 85, frequency: 10 },
            { slug: 'era-vargas', name: 'Era Vargas', weight: 72, frequency: 9 },
            { slug: 'ditadura-militar', name: 'Ditadura militar', weight: 75, frequency: 9 },
            { slug: 'brasil-colonia', name: 'Brasil Colônia', weight: 62, frequency: 8 },
            { slug: 'idade-media', name: 'Idade Média e feudalismo', weight: 45, frequency: 6 },
            { slug: 'revolucao-industrial', name: 'Revolução Industrial', weight: 60, frequency: 8 },
            { slug: 'guerras-mundiais', name: 'Guerras Mundiais e Guerra Fria', weight: 65, frequency: 8 },
            { slug: 'geografia-urbana', name: 'Geografia urbana', weight: 78, frequency: 10 },
            { slug: 'geografia-agraria', name: 'Geografia agrária', weight: 68, frequency: 9 },
            { slug: 'globalizacao', name: 'Globalização', weight: 75, frequency: 9 },
            { slug: 'climatologia', name: 'Climatologia e domínios morfoclimáticos', weight: 70, frequency: 9 },
            { slug: 'demografia', name: 'Demografia', weight: 62, frequency: 8 },
            { slug: 'filosofia-antiga', name: 'Filosofia antiga', weight: 55, frequency: 8 },
            { slug: 'filosofia-politica', name: 'Filosofia política e contratualismo', weight: 65, frequency: 8 },
            { slug: 'sociologia-classicos', name: 'Sociologia: Marx, Weber e Durkheim', weight: 72, frequency: 9 },
            { slug: 'cidadania-direitos', name: 'Cidadania e direitos humanos', weight: 80, frequency: 10 },
          ],
        },
      ],
    },

    {
      slug: 'oab',
      name: 'OAB — 1ª fase',
      description: 'Exame de Ordem. 80 questões objetivas, todas as áreas do Direito.',
      disciplines: [
        {
          slug: 'etica',
          name: 'Ética Profissional',
          color: '#C8FF4D',
          topics: [
            // Ética é a maior incidência isolada da 1ª fase e a que mais
            // reprova por descuido: todo mundo estuda Constitucional e ninguém
            // estuda o Estatuto da Advocacia.
            { slug: 'estatuto-advocacia', name: 'Estatuto da Advocacia', weight: 95, frequency: 10 },
            { slug: 'codigo-etica', name: 'Código de Ética e Disciplina', weight: 92, frequency: 10 },
            { slug: 'honorarios', name: 'Honorários advocatícios', weight: 80, frequency: 10 },
            { slug: 'infracoes-disciplinares', name: 'Infrações e sanções disciplinares', weight: 85, frequency: 10 },
          ],
        },
        {
          slug: 'constitucional',
          name: 'Direito Constitucional',
          color: '#4D9FFF',
          topics: [
            { slug: 'direitos-fundamentais', name: 'Direitos e garantias fundamentais', weight: 92, frequency: 10 },
            { slug: 'controle-constitucionalidade', name: 'Controle de constitucionalidade', weight: 85, frequency: 10 },
            { slug: 'organizacao-estado', name: 'Organização do Estado', weight: 70, frequency: 9 },
            { slug: 'poderes', name: 'Organização dos Poderes', weight: 75, frequency: 9 },
            { slug: 'remedios-constitucionais', name: 'Remédios constitucionais', weight: 78, frequency: 9 },
          ],
        },
        {
          slug: 'civil',
          name: 'Direito Civil',
          color: '#FF8A4D',
          topics: [
            { slug: 'obrigacoes', name: 'Obrigações', weight: 82, frequency: 10 },
            { slug: 'contratos', name: 'Contratos', weight: 85, frequency: 10 },
            { slug: 'responsabilidade-civil', name: 'Responsabilidade civil', weight: 88, frequency: 10 },
            { slug: 'familia', name: 'Direito de Família', weight: 75, frequency: 9 },
            { slug: 'sucessoes', name: 'Direito das Sucessões', weight: 70, frequency: 9 },
            { slug: 'reais', name: 'Direitos Reais', weight: 65, frequency: 8 },
          ],
        },
        {
          slug: 'processo-civil',
          name: 'Processo Civil',
          color: '#A78BFA',
          topics: [
            { slug: 'recursos', name: 'Recursos', weight: 88, frequency: 10 },
            { slug: 'tutela-provisoria', name: 'Tutela provisória', weight: 78, frequency: 9 },
            { slug: 'procedimento-comum', name: 'Procedimento comum', weight: 80, frequency: 10 },
            { slug: 'execucao', name: 'Execução e cumprimento de sentença', weight: 72, frequency: 9 },
            { slug: 'competencia', name: 'Competência', weight: 70, frequency: 9 },
          ],
        },
        {
          slug: 'penal',
          name: 'Direito Penal e Processo Penal',
          color: '#FF5A5A',
          topics: [
            { slug: 'teoria-crime', name: 'Teoria geral do crime', weight: 85, frequency: 10 },
            { slug: 'penas', name: 'Aplicação da pena', weight: 75, frequency: 9 },
            { slug: 'crimes-especie', name: 'Crimes em espécie', weight: 78, frequency: 10 },
            { slug: 'prisao-medidas', name: 'Prisão e medidas cautelares', weight: 80, frequency: 10 },
            { slug: 'processo-penal-recursos', name: 'Recursos no processo penal', weight: 65, frequency: 8 },
          ],
        },
        {
          slug: 'trabalho',
          name: 'Direito do Trabalho e Processo do Trabalho',
          color: '#4ADE80',
          topics: [
            { slug: 'contrato-trabalho', name: 'Contrato de trabalho', weight: 85, frequency: 10 },
            { slug: 'jornada', name: 'Jornada de trabalho', weight: 78, frequency: 9 },
            { slug: 'rescisao', name: 'Rescisão contratual e verbas', weight: 82, frequency: 10 },
            { slug: 'processo-trabalho', name: 'Processo do trabalho', weight: 70, frequency: 9 },
          ],
        },
        {
          slug: 'administrativo',
          name: 'Direito Administrativo',
          color: '#FBBF24',
          topics: [
            { slug: 'atos-administrativos', name: 'Atos administrativos', weight: 85, frequency: 10 },
            { slug: 'licitacoes', name: 'Licitações e contratos', weight: 80, frequency: 10 },
            { slug: 'servidores', name: 'Agentes públicos', weight: 68, frequency: 9 },
            { slug: 'improbidade', name: 'Improbidade administrativa', weight: 72, frequency: 9 },
          ],
        },
        {
          slug: 'tributario',
          name: 'Direito Tributário',
          color: '#C4C4CE',
          topics: [
            { slug: 'competencia-tributaria', name: 'Competência tributária', weight: 78, frequency: 9 },
            { slug: 'limitacoes-poder-tributar', name: 'Limitações ao poder de tributar', weight: 82, frequency: 10 },
            { slug: 'obrigacao-tributaria', name: 'Obrigação e crédito tributário', weight: 75, frequency: 9 },
            { slug: 'impostos-especie', name: 'Impostos em espécie', weight: 70, frequency: 9 },
          ],
        },
      ],
    },

    {
      slug: 'concursos',
      name: 'Concursos Públicos',
      description:
        'Base comum da maioria dos editais. As disciplinas específicas de cada ' +
        'carreira entram como tracks próprios quando houver demanda.',
      disciplines: [
        {
          slug: 'portugues',
          name: 'Língua Portuguesa',
          color: '#FF8A4D',
          topics: [
            { slug: 'interpretacao', name: 'Interpretação e compreensão de texto', weight: 92, frequency: 10 },
            { slug: 'concordancia', name: 'Concordância verbal e nominal', weight: 85, frequency: 10 },
            { slug: 'regencia', name: 'Regência verbal e nominal', weight: 80, frequency: 10 },
            { slug: 'crase', name: 'Crase', weight: 78, frequency: 10 },
            { slug: 'pontuacao', name: 'Pontuação', weight: 82, frequency: 10 },
            { slug: 'ortografia', name: 'Ortografia', weight: 70, frequency: 9 },
            { slug: 'morfologia', name: 'Classes de palavras', weight: 72, frequency: 9 },
            { slug: 'sintaxe-periodo', name: 'Sintaxe do período composto', weight: 75, frequency: 9 },
          ],
        },
        {
          slug: 'raciocinio-logico',
          name: 'Raciocínio Lógico e Matemático',
          color: '#4D9FFF',
          topics: [
            { slug: 'proposicoes', name: 'Lógica proposicional', weight: 88, frequency: 10 },
            { slug: 'equivalencias', name: 'Equivalências e negações', weight: 85, frequency: 10 },
            { slug: 'argumentos', name: 'Argumentos e validade', weight: 78, frequency: 9 },
            { slug: 'raciocinio-sequencial', name: 'Sequências e padrões', weight: 70, frequency: 9 },
            { slug: 'porcentagem-juros', name: 'Porcentagem e juros', weight: 80, frequency: 10 },
            { slug: 'probabilidade-combinatoria', name: 'Probabilidade e combinatória', weight: 72, frequency: 9 },
          ],
        },
        {
          slug: 'direito-constitucional',
          name: 'Direito Constitucional',
          color: '#4ADE80',
          topics: [
            { slug: 'principios-fundamentais', name: 'Princípios fundamentais', weight: 82, frequency: 10 },
            { slug: 'direitos-garantias', name: 'Direitos e garantias fundamentais', weight: 92, frequency: 10 },
            { slug: 'administracao-publica', name: 'Administração pública na CF', weight: 85, frequency: 10 },
            { slug: 'organizacao-poderes', name: 'Organização dos Poderes', weight: 75, frequency: 9 },
          ],
        },
        {
          slug: 'direito-administrativo',
          name: 'Direito Administrativo',
          color: '#FBBF24',
          topics: [
            { slug: 'principios-administrativos', name: 'Princípios da administração', weight: 88, frequency: 10 },
            { slug: 'atos', name: 'Atos administrativos', weight: 85, frequency: 10 },
            { slug: 'licitacoes-contratos', name: 'Licitações e contratos', weight: 82, frequency: 10 },
            { slug: 'agentes-publicos', name: 'Agentes públicos', weight: 78, frequency: 10 },
            { slug: 'improbidade-adm', name: 'Improbidade administrativa', weight: 72, frequency: 9 },
          ],
        },
        {
          slug: 'informatica',
          name: 'Noções de Informática',
          color: '#A78BFA',
          topics: [
            { slug: 'seguranca', name: 'Segurança da informação', weight: 82, frequency: 10 },
            { slug: 'office', name: 'Pacote Office e editores', weight: 78, frequency: 10 },
            { slug: 'redes-internet', name: 'Redes e internet', weight: 72, frequency: 9 },
            { slug: 'sistemas-operacionais', name: 'Sistemas operacionais', weight: 68, frequency: 9 },
          ],
        },
      ],
    },
  ],
};
