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
