import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const storageBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET');

    /**
     * **Três variáveis simples vencem uma variável complicada.**
     *
     * Esta é a saída de emergência para o JSON num campo de painel, que já
     * quebrou de duas formas diferentes: aspas escapadas e `\n` expandido em
     * quebra de linha real. Nenhuma delas é culpa de quem configurou — é o
     * editor mexendo no valor.
     *
     * `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`
     * são strings curtas e sem estrutura, então não há o que um editor estrague.
     * Só a chave privada tem `\n`, e ela é normalizada aqui — é a convenção que
     * o resto do ecossistema já usa por esta mesma razão.
     *
     * Tem precedência sobre o JSON: quem setou as três está corrigindo um JSON
     * que não funcionou, e o conserto tem que ganhar do que estava quebrado.
     */
    const contaPorPartes = this.contaDeVariaveisSeparadas();
    if (contaPorPartes) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert(contaPorPartes),
        storageBucket,
      });
      return;
    }

    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    if (serviceAccountJson) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert(this.lerContaDeServico(serviceAccountJson)),
        storageBucket,
      });
    } else {
      this.app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket,
      });
    }
  }

  /** A conta montada de `FIREBASE_PROJECT_ID` + `CLIENT_EMAIL` + `PRIVATE_KEY`. */
  private contaDeVariaveisSeparadas(): admin.ServiceAccount | null {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID')?.trim();
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL')?.trim();
    const privateKeyBruta = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKeyBruta) return null;

    const privateKey = privateKeyBruta
      .trim()
      // Aspas que o painel embrulha em volta do valor.
      .replace(/^['"]|['"]$/g, '')
      // `\n` literal vira quebra de verdade: o PEM precisa das linhas, e é
      // assim que a chave sobrevive a um campo de uma linha só.
      .replace(/\\n/g, '\n');

    return { projectId, clientEmail, privateKey };
  }

  /**
   * O JSON da conta de serviço, com as duas formas que os painéis produzem.
   *
   * Um `JSON.parse` cru aqui derrubou um deploy inteiro com
   * `SyntaxError: Expected property name or '}' in JSON at position 1` — uma
   * mensagem que não nomeia a variável, não diz de onde veio e aponta para o
   * `on-module-init.hook` do Nest na pilha. Custou horas para ser lida como "o
   * valor de `FIREBASE_SERVICE_ACCOUNT_JSON` está escapado".
   *
   * **A forma escapada é aceita de propósito.** `{\"type\":...` é o que sai de
   * um campo de painel que passou o valor por uma camada de `stringify`, e é um
   * erro de operação, não de conteúdo: a chave está correta, só chegou vestida.
   * Recusar seria tecnicamente defensável e praticamente inútil — o operador
   * não tem como saber, e o app fica fora do ar.
   */
  private lerContaDeServico(bruto: string): admin.ServiceAccount {
    const texto = bruto.trim();

    const semAspasSoltas = texto.replace(/^['"]|['"]$/g, '');
    /**
     * Quebras de linha **reais** dentro do JSON.
     *
     * Foi o que derrubou o deploy de 07/08: o editor do Dokploy expande os `\n`
     * da chave privada em newlines de verdade, e JSON não aceita caractere de
     * controle cru dentro de string. O valor chega começando certo
     * (`{"type":"service_account"…`) e estoura no meio do PEM — que é o pior
     * lugar para procurar, porque o começo parece perfeito.
     *
     * Reescapar devolve exatamente o que o `JSON.stringify` tinha produzido.
     */
    const comQuebrasReescapadas = semAspasSoltas
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n');

    const tentativas = [
      texto,
      semAspasSoltas,
      // Aspas escapadas: desfaz `\"` → `"` e `\\n` → `\n`, nesta ordem — o
      // inverso desfaria o escape das aspas dentro da chave privada.
      semAspasSoltas.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n'),
      comQuebrasReescapadas,
      // As duas patologias juntas: aspas escapadas E quebras expandidas.
      comQuebrasReescapadas.replace(/\\"/g, '"'),
    ];

    let ultimoErro = '';
    for (const tentativa of tentativas) {
      try {
        const conta = JSON.parse(tentativa);
        if (conta && typeof conta === 'object' && conta.project_id) return conta;
      } catch (erro) {
        ultimoErro = erro instanceof Error ? erro.message : String(erro);
      }
    }

    /**
     * A mensagem carrega o diagnóstico, não só a reclamação.
     *
     * A versão anterior mostrava 40 caracteres do começo — e o começo estava
     * certo, então ela escondeu exatamente a informação que resolvia. Agora vai
     * o tamanho (denuncia truncamento), se há quebra de linha crua, e o erro do
     * `JSON.parse`, que aponta a posição.
     */
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON não é um JSON válido. Deve ser o arquivo da ' +
        'conta de serviço inteiro, com aspas normais e os `\\n` da chave privada ' +
        'preservados como dois caracteres. ' +
        `[${texto.length} caracteres, ` +
        `${/[\n\r]/.test(texto) ? 'CONTÉM quebra de linha crua' : 'sem quebra de linha'}, ` +
        `começa com "${texto.slice(0, 30)}"] ` +
        `Último erro do parser: ${ultimoErro}`,
    );
  }

  getAuth(): admin.auth.Auth {
    return this.app.auth();
  }

  getStorage(): admin.storage.Storage {
    return this.app.storage();
  }

  getMessaging(): admin.messaging.Messaging {
    return this.app.messaging();
  }
}
