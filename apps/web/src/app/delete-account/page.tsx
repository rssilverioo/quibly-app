import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Excluir Conta - Quibly',
  description: 'Solicite a exclusão da sua conta e dados do Quibly.',
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-[#141420] rounded-2xl p-8 border border-[#2A2A3E]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Excluir Conta do Quibly</h1>
          <p className="text-gray-400">Account Deletion Request</p>
        </div>

        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Como solicitar a exclusão</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Abra o app <strong>Quibly</strong> no seu dispositivo</li>
              <li>Vá em <strong>Perfil</strong> (ícone no canto inferior direito)</li>
              <li>Toque em <strong>Configurações</strong></li>
              <li>Role até o final e toque em <strong>Excluir minha conta</strong></li>
              <li>Confirme a exclusão</li>
            </ol>
            <p className="mt-3 text-sm text-gray-400">
              Você também pode solicitar a exclusão enviando um e-mail para{' '}
              <a href="mailto:support@tryquibly.com" className="text-blue-400 underline">
                support@tryquibly.com
              </a>{' '}
              com o assunto &quot;Excluir minha conta&quot;.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Dados que serão excluídos</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Informações do perfil (nome, e-mail, foto)</li>
              <li>Histórico de estudo e progresso</li>
              <li>Quizzes e flashcards criados</li>
              <li>Dados de participação em ligas</li>
              <li>Tokens de notificação push</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Dados que podem ser mantidos</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Registros de transações financeiras (exigido por lei) — mantidos por até 5 anos</li>
              <li>Logs de segurança anonimizados — mantidos por até 90 dias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Prazo</h2>
            <p>
              A exclusão da conta e dos dados é processada em até <strong>30 dias</strong> após a
              solicitação. Você receberá uma confirmação por e-mail quando o processo for concluído.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2A2A3E] text-center text-sm text-gray-500">
          <p>Quibly &copy; {new Date().getFullYear()} &mdash; Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
