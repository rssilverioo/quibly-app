import { FirebaseService } from './firebase.service';

/** O mínimo que `admin.credential.cert` exige, e o que o teste precisa ver. */
const CONTA = {
  type: 'service_account',
  project_id: 'quibly-70e89',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n',
  client_email: 'x@quibly-70e89.iam.gserviceaccount.com',
};

const ler = (valor: string) => {
  const service = new FirebaseService({ get: () => valor } as any);
  return (service as any).lerContaDeServico(valor);
};

/**
 * Um `JSON.parse` cru aqui derrubou um deploy inteiro, com uma mensagem que não
 * nomeava a variável e apontava para dentro do Nest na pilha. Estes testes
 * existem para que a próxima pessoa leia o motivo em vez de deduzi-lo.
 */
describe('FIREBASE_SERVICE_ACCOUNT_JSON', () => {
  it('aceita o JSON como o Firebase entrega', () => {
    expect(ler(JSON.stringify(CONTA)).project_id).toBe('quibly-70e89');
  });

  it('aceita o valor com as aspas escapadas, que é o que o painel produziu', () => {
    // `{\"type\":\"service_account\"...` — o valor que quebrou o deploy.
    const escapado = JSON.stringify(CONTA).replace(/"/g, '\\"');

    const conta = ler(escapado);

    expect(conta.project_id).toBe('quibly-70e89');
    // A chave privada tem que sobreviver inteira: os `\n` dela são parte do
    // PEM, e desfazer o escape na ordem errada os transformaria em texto.
    expect(conta.private_key).toContain('-----BEGIN PRIVATE KEY-----');
    expect(conta.private_key).toContain('\n');
  });

  it('aceita o valor embrulhado em aspas simples', () => {
    expect(ler(`'${JSON.stringify(CONTA)}'`).project_id).toBe('quibly-70e89');
  });

  it('ignora espaço em volta', () => {
    expect(ler(`\n  ${JSON.stringify(CONTA)}  \n`).project_id).toBe('quibly-70e89');
  });

  it('recusa JSON válido que não é uma conta de serviço', () => {
    // Um objeto que faz `parse` mas não serve — sem isto o erro só apareceria
    // depois, dentro do SDK do Firebase, sem dizer que veio daqui.
    expect(() => ler('{"foo":"bar"}')).toThrow(/FIREBASE_SERVICE_ACCOUNT_JSON/);
  });

  it('a mensagem nomeia a variável e mostra o começo do valor', () => {
    // A mensagem antiga era `SyntaxError: Expected property name or '}' in JSON
    // at position 1`, sem uma palavra sobre qual variável era.
    expect(() => ler('nada disso')).toThrow(/FIREBASE_SERVICE_ACCOUNT_JSON/);
    expect(() => ler('nada disso')).toThrow(/nada disso/);
  });
});

/**
 * A patologia que derrubou o deploy de 07/08.
 *
 * O editor do Dokploy expande os `\n` da chave privada em quebras de linha
 * reais. O valor chega **começando certo** — `{"type":"service_account"…` — e
 * estoura no meio do PEM, que é o pior lugar para procurar. A mensagem de erro
 * anterior mostrava só 40 caracteres do começo, e o começo estava perfeito:
 * escondeu exatamente a informação que resolvia.
 */
describe('FIREBASE_SERVICE_ACCOUNT_JSON — quebras de linha reais', () => {
  it('aceita o JSON com os `\\n` expandidos em quebras de verdade', () => {
    // `\n` (dois caracteres) vira quebra real, como o painel faz.
    const quebrado = JSON.stringify(CONTA).replace(/\\n/g, '\n');

    // Confirma que a entrada é mesmo inválida como JSON — senão o teste passa
    // por acidente e não prova nada.
    expect(() => JSON.parse(quebrado)).toThrow();

    const conta = ler(quebrado);

    expect(conta.project_id).toBe('quibly-70e89');
    expect(conta.private_key).toContain('-----BEGIN PRIVATE KEY-----');
    expect(conta.private_key).toContain('\n');
  });

  it('aceita as duas patologias juntas: aspas escapadas E quebras expandidas', () => {
    const duplo = JSON.stringify(CONTA).replace(/"/g, '\\"').replace(/\\n/g, '\n');

    expect(ler(duplo).project_id).toBe('quibly-70e89');
  });

  it('a mensagem de erro traz tamanho, quebra de linha e o erro do parser', () => {
    // Sem esses três dados, a próxima falha vira outra caça ao tesouro.
    try {
      ler('{"type":"service_account","private_key":"quebrado');
      throw new Error('devia ter lançado');
    } catch (erro) {
      const msg = (erro as Error).message;
      expect(msg).toMatch(/caracteres/);
      expect(msg).toMatch(/quebra de linha/);
      expect(msg).toMatch(/Último erro do parser/);
    }
  });
});

/**
 * A saída de emergência: três variáveis simples em vez de uma complicada.
 */
describe('FIREBASE_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY', () => {
  const montar = (vars: Record<string, string | undefined>) => {
    const service = new FirebaseService({
      get: (chave: string) => vars[chave],
    } as any);
    return (service as any).contaDeVariaveisSeparadas();
  };

  it('monta a conta e converte os `\\n` literais em quebras reais', () => {
    const conta = montar({
      FIREBASE_PROJECT_ID: 'quibly-70e89',
      FIREBASE_CLIENT_EMAIL: 'x@quibly-70e89.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----\\n',
    });

    expect(conta.projectId).toBe('quibly-70e89');
    // O PEM precisa das linhas de verdade para o SDK aceitar a chave.
    expect(conta.privateKey).toContain('\n');
    expect(conta.privateKey).not.toContain('\\n');
  });

  it('tira as aspas que o painel embrulha na chave', () => {
    const conta = montar({
      FIREBASE_PROJECT_ID: 'quibly-70e89',
      FIREBASE_CLIENT_EMAIL: 'x@y.com',
      FIREBASE_PRIVATE_KEY: '"-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----\\n"',
    });

    expect(conta.privateKey.startsWith('-----BEGIN')).toBe(true);
  });

  it('não assume o caminho quando falta alguma das três', () => {
    // Meia configuração é pior que nenhuma: cairia no `cert()` com campo vazio
    // e o erro viria de dentro do SDK, sem dizer o que faltou.
    expect(montar({ FIREBASE_PROJECT_ID: 'x', FIREBASE_CLIENT_EMAIL: 'y' })).toBeNull();
    expect(montar({})).toBeNull();
  });
});
