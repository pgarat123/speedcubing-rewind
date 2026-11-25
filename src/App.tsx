import { useTranslation } from 'react-i18next';
import { YEAR } from './config';

// Écran d'accueil provisoire : la story et le parcours arrivent à l'étape UI.
export default function App() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-full max-w-[430px] flex-col px-6 pb-7 pt-5">
      <p className="text-xs font-extrabold tracking-[0.14em]">SPEEDCUBING REWIND</p>
      <h1 className="hero mt-9 text-[38px] whitespace-normal">{t('home.title', { year: YEAR })}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[#D6D5DC]">{t('home.lead')}</p>
      <div className="grow" />
      <div className="flex flex-col gap-2.5">
        <button className="h-14 rounded-[14px] bg-record text-[17px] font-extrabold text-ink">{t('home.login')}</button>
        <button className="h-[52px] rounded-[14px] border-[1.5px] border-line text-base font-bold">{t('home.noWca')}</button>
      </div>
      <p className="mt-4 text-center text-[13px] text-quiet">{t('home.privacy')}</p>
    </main>
  );
}
