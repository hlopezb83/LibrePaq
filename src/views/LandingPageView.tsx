import { useRef, useState } from 'react';
import { AuthModal } from '../components/auth/AuthModal';
import { useAuth } from '../context/AuthContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { LandingNavbar } from './landing/LandingNavbar';
import { LandingHeroSection } from './landing/LandingHeroSection';
import { LandingComparisonSection } from './landing/LandingComparisonSection';
import { LandingRoiCalculator } from './landing/LandingRoiCalculator';
import { LandingFeaturesSection } from './landing/LandingFeaturesSection';
import { LandingPricingSection } from './landing/LandingPricingSection';
import { LandingFaqSection } from './landing/LandingFaqSection';
import { LandingFooterSection } from './landing/LandingFooterSection';

export function LandingPageView() {
  const { user, startGuestDemo } = useAuth();
  const authDialogRef = useRef<HTMLDialogElement>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const openSignupAuth = () => {
    setAuthMode('signup');
    trackAnalyticsEvent('click_cta_comenzar_gratis', { location: 'landing', mode: 'signup' });
    if (authDialogRef.current && !authDialogRef.current.open) authDialogRef.current.showModal();
  };

  const openSigninAuth = () => {
    setAuthMode('signin');
    trackAnalyticsEvent('click_cta_iniciar_sesion', { location: 'navbar', mode: 'signin' });
    if (authDialogRef.current && !authDialogRef.current.open) authDialogRef.current.showModal();
  };

  const handleOpenDemo = async () => {
    trackAnalyticsEvent('click_cta_explorar_demo', { location: 'landing_hero' });
    await startGuestDemo();
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      <a
        href="#main-content"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-blue-700 focus:text-white focus:text-xs focus:font-bold focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>

      {/* Diálogo de Autenticación Supabase / Google OAuth */}
      <AuthModal dialogRef={authDialogRef} initialMode={authMode} />

      {/* 1. Header / Barra de Navegación Sticky */}
      <LandingNavbar user={user} onOpenAuth={openSignupAuth} onOpenSignIn={openSigninAuth} />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* 2. Hero Section Principal con Maqueta Interactiva */}
        <LandingHeroSection onOpenAuth={openSignupAuth} onOpenDemo={handleOpenDemo} />

      {/* 3. Comparativa Cara a Cara: CONTPAQi® vs. LibrePaq Pro */}
      <LandingComparisonSection />

      {/* 4. Calculadora Interactiva de Ahorro y ROI */}
      <LandingRoiCalculator onOpenAuth={openSignupAuth} />

      {/* 5. Módulos y Características Clave */}
      <LandingFeaturesSection />

      {/* 6. Planes de Precios Transparentes */}
      <LandingPricingSection onOpenAuth={openSignupAuth} />

        {/* 7. Preguntas Frecuentes (FAQ Accordion) */}
        <LandingFaqSection />
      </main>

      {/* 8. Llamado a la Acción Final y Footer */}
      <LandingFooterSection onOpenAuth={openSignupAuth} />
    </div>
  );
}
