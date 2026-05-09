import { Route, Switch } from "wouter";
import { Header } from "@/components/Header";
import { useUser } from "@/lib/useUser";
import { HomePage } from "@/pages/Home";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminApps } from "@/pages/admin/AdminApps";
import { AdminGroups } from "@/pages/admin/AdminGroups";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";
import { AdminAnnouncements } from "@/pages/admin/AdminAnnouncements";
import { AdminClients } from "@/pages/admin/AdminClients";
import { AdminFinance } from "@/pages/admin/AdminFinance";
import { CalculatorPage } from "@/pages/Calculator";
import { VideoCalculatorPage } from "@/pages/VideoCalculator";

function App() {
  const state = useUser();
  const user = state.status === "authenticated" ? state.user : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header user={user} />

      <main className="flex-1 flex flex-col items-center px-6 py-12">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/calculator" component={CalculatorPage} />
          <Route path="/video-calculator" component={VideoCalculatorPage} />
          <Route path="/admin">
            <AdminLayout>
              <AdminAnnouncements />
            </AdminLayout>
          </Route>
          <Route path="/admin/announcements">
            <AdminLayout>
              <AdminAnnouncements />
            </AdminLayout>
          </Route>
          <Route path="/admin/clients">
            <AdminLayout>
              <AdminClients />
            </AdminLayout>
          </Route>
          <Route path="/admin/finance">
            <AdminLayout>
              <AdminFinance />
            </AdminLayout>
          </Route>
          <Route path="/admin/users">
            <AdminLayout>
              <AdminUsers />
            </AdminLayout>
          </Route>
          <Route path="/admin/apps">
            <AdminLayout>
              <AdminApps />
            </AdminLayout>
          </Route>
          <Route path="/admin/groups">
            <AdminLayout>
              <AdminGroups />
            </AdminLayout>
          </Route>
          <Route path="/admin/analytics">
            <AdminLayout>
              <AdminAnalytics />
            </AdminLayout>
          </Route>
          <Route>
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Page not found.{" "}
              <a href="/" className="ml-2 text-tmc-gold-dark hover:underline">
                Go home
              </a>
            </div>
          </Route>
        </Switch>
      </main>

      <footer className="border-t border-tmc-gold/20 px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TMC Marketing
        </p>
      </footer>
    </div>
  );
}

export default App;
