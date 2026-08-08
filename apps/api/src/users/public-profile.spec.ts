import { serializePublicProfile } from './users.service';

/**
 * O perfil de outra pessoa não pode carregar a vida dela.
 *
 * `getProfileByHandle` devolvia a linha inteira do banco, e como o handle é
 * público por natureza — aparece no feed, no ranking e no chat — qualquer
 * pessoa logada conseguia o e-mail de qualquer outra. O app nunca chamou essa
 * rota, então o vazamento estava armado para disparar junto com a tela de
 * perfil público.
 */
describe('serializePublicProfile', () => {
  const perfilCompleto = {
    id: 'u1',
    email: 'pessoa@exemplo.com',
    username: 'Rodrigo',
    handle: 'rodrigo',
    avatarUrl: null,
    bio: 'Estudando para 2026',
    verified: true,
    level: 8,
    totalXp: 2450,
    currentStreak: 12,
    longestStreak: 30,
    totalStudyMinutes: 4200,
    verifiedHours: '70.5',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    // Tudo abaixo existe na linha do banco e não pode sair daqui.
    plan: 'PRO',
    subscriptionStatus: 'active',
    currentPeriodEnd: new Date(),
    subscriptionPlatform: 'apple',
    educationLevel: 'college',
    studyGoal: 'exam_prep',
    dailyGoalMinutes: 60,
  };

  it('não devolve e-mail', () => {
    const publico = serializePublicProfile(perfilCompleto as any);
    expect(JSON.stringify(publico)).not.toContain('pessoa@exemplo.com');
  });

  it('não devolve a vida financeira da pessoa', () => {
    const publico = serializePublicProfile(perfilCompleto as any) as any;
    expect(publico.plan).toBeUndefined();
    expect(publico.subscriptionStatus).toBeUndefined();
    expect(publico.currentPeriodEnd).toBeUndefined();
    expect(publico.subscriptionPlatform).toBeUndefined();
  });

  it('não devolve o que a pessoa respondeu no onboarding', () => {
    const publico = serializePublicProfile(perfilCompleto as any) as any;
    expect(publico.educationLevel).toBeUndefined();
    expect(publico.studyGoal).toBeUndefined();
    expect(publico.dailyGoalMinutes).toBeUndefined();
  });

  /**
   * A lista é fechada de propósito. Com `omit`, toda coluna nova nasceria
   * pública e quem a acrescentar daqui a seis meses não teria como saber.
   * Este teste quebra quando alguém acrescenta um campo aqui sem pensar.
   */
  it('devolve exatamente os campos públicos, e nada mais', () => {
    const publico = serializePublicProfile(perfilCompleto as any);

    expect(Object.keys(publico).sort()).toEqual(
      [
        'avatar_url', 'bio', 'current_streak', 'handle', 'id', 'level',
        'longest_streak', 'member_since', 'total_study_minutes', 'total_xp',
        'username', 'verified', 'verified_hours',
      ].sort(),
    );
  });

  it('o selo de verificado é público — é para ser visto', () => {
    expect(serializePublicProfile(perfilCompleto as any).verified).toBe(true);
  });
});
