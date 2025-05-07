import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { OnboardingProvider } from "@/hooks/use-onboarding";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OnboardingTutorialWrapper from "@/components/OnboardingTutorialWrapper";
import CookieConsent from "@/components/CookieConsent";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import BetcodeListingsPage from "@/pages/betcode-listings-page";
import PaymentPage from "@/pages/payment-page";
import SellerAccountPage from "@/pages/seller-account-page";
import AccountPage from "@/pages/account-page";
import AdminPanelPage from "@/pages/admin-panel-page";
import AdminDashboard from "@/pages/admin-dashboard";
import TermsPage from "@/pages/terms-page";
import PrivacyPage from "@/pages/privacy-page";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";
import { useLocation } from "wouter";

function Router() {
  return (
    <Switch>
      {/* Admin dashboard - completely separate from main site */}
      <Route path="/admin-dashboard" component={AdminDashboard} />
      
      {/* Regular site routing */}
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/browse" component={BetcodeListingsPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/payment/:id" component={PaymentPage} />
      <ProtectedRoute path="/account" component={AccountPage} />
      <ProtectedRoute path="/seller-account" component={SellerAccountPage} />
      <ProtectedRoute path="/admin" component={AdminPanelPage} adminOnly={true} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isAdminDashboard = location.startsWith('/admin-dashboard');
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnboardingProvider>
          <TooltipProvider>
            {isAdminDashboard ? (
              // Admin dashboard - no header/footer
              <main className="min-h-screen">
                <Router />
              </main>
            ) : (
              // Regular site with header/footer
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow">
                  <Router />
                  <OnboardingTutorialWrapper />
                </main>
                <Footer />
                <CookieConsent />
              </div>
            )}
          </TooltipProvider>
        </OnboardingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
