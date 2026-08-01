'use client';

import { Compass, Sparkles } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCoachAdvice } from '../hooks/useCoachAdvice';
import { emergencyFundSchema } from '@/lib/coachSchemas';
import CoachRegenerateButton from './CoachRegenerateButton';

interface Props {
  emergencyFundBalance: number;
  emergencyFundTarget: number;
  emergencyFundTargetMonths: number;
  monthsCovered: number;
  avgMonthlyExpenses: number;
}

export default function EmergencyFundStrategy({
  emergencyFundBalance,
  emergencyFundTarget,
  emergencyFundTargetMonths,
  monthsCovered,
  avgMonthlyExpenses,
}: Props) {
  const { t } = useLanguage();
  const { advice, loading, regenerating, failed, generatedAt, regenerate } = useCoachAdvice(
    '/api/coach/emergency-fund',
    emergencyFundSchema,
    { emergencyFundBalance, emergencyFundTarget, emergencyFundTargetMonths, monthsCovered, avgMonthlyExpenses },
  );

  const complete = Boolean(advice?.objectif && advice?.methode && advice?.recommandations?.length);

  return (
    <div className="bg-surface rounded-xl border border-line p-6">
      <div className="flex items-center gap-3 mb-6">
        <Compass className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-body">{t('coach.emergency.title')}</h3>
        <div className="ml-auto flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {t('coach.analyzing')}
            </span>
          )}
          {!loading && complete && !failed && (
            <>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                {t('coach.aiCoach')}
              </span>
              <CoachRegenerateButton onClick={regenerate} loading={regenerating} />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-surface-alt rounded w-full" />
          <div className="h-3 bg-surface-alt rounded w-5/6" />
          <div className="h-3 bg-surface-alt rounded w-4/6" />
          <div className="h-3 bg-surface-alt rounded w-full mt-4" />
          <div className="h-3 bg-surface-alt rounded w-3/6" />
        </div>
      ) : complete && !failed ? (
        <div className="space-y-4 text-[13px] leading-relaxed text-muted">
          <p>
            <span className="font-bold text-body">{t('coach.emergency.diagnostic')}</span> {advice?.objectif}
          </p>
          <p>
            <span className="font-bold text-body">{t('coach.emergency.method')}</span> {advice?.methode}
          </p>
          <div>
            <p className="font-bold text-body mb-2">{t('coach.emergency.recommendations')}</p>
            <ul className="space-y-1.5 list-disc list-inside marker:text-blue-400">
              {advice?.recommandations?.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          {generatedAt && (
            <p className="text-[10px] text-faint italic pt-1">
              {t('coach.generatedOn')}{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , {t('coach.weeklyRefresh')}
            </p>
          )}
        </div>
      ) : (
        <StaticFallback t={t} />
      )}
    </div>
  );
}

// Contenu générique conservé comme repli si l'appel au Coach IA échoue
// (clé API manquante, quota dépassé, erreur réseau...).
function StaticFallback({ t }: { t: ReturnType<typeof useLanguage>['t'] }) {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-muted">
      <p>
        <span className="font-bold text-body">{t('coach.emergency.objectiveLabel')}</span>{' '}
        {t('coach.emergency.staticObjectiveText')}
      </p>
      <p>
        <span className="font-bold text-body">{t('coach.emergency.method')}</span>{' '}
        {t('coach.emergency.staticMethodText')}
      </p>
      <div>
        <p className="font-bold text-body mb-2">{t('coach.emergency.placementsTitle')}</p>
        <ul className="space-y-1.5 list-disc list-inside marker:text-blue-400">
          <li>{t('coach.emergency.placement1')}</li>
          <li>{t('coach.emergency.placement2')}</li>
          <li>{t('coach.emergency.placement3')}</li>
        </ul>
      </div>
    </div>
  );
}
