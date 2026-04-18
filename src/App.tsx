import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AppLayout } from "@/components/AppLayout";
import Overview from "./pages/Overview";
import Conflicts from "./pages/Conflicts";
import Scenarios from "./pages/Scenarios";
import Plan from "./pages/Plan";
import Memo from "./pages/Memo";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CompanyProvider>
        <AnalysisProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/conflicts" element={<Conflicts />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/memo" element={<Memo />} />
              <Route path="/help" element={<Help />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnalysisProvider>
        </CompanyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
