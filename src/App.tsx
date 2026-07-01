import { Route, Switch } from "wouter";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { TeamNav } from "@/components/TeamNav";
import { useUser } from "@/lib/useUser";
import { useAppVersion } from "@/lib/useAppVersion";
import { HomePage } from "@/pages/Home";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminApps } from "@/pages/admin/AdminApps";
import { AdminGroups } from "@/pages/admin/AdminGroups";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";
import { AdminAnnouncements } from "@/pages/admin/AdminAnnouncements";
import { AdminClients } from "@/pages/admin/AdminClients";
import { AdminFinance } from "@/pages/admin/AdminFinance";
import { AdminTimeClock } from "@/pages/admin/AdminTimeClock";
import { AdminTimeOff } from "@/pages/admin/AdminTimeOff";
import { RequestsPage } from "@/pages/Requests";
import { CalculatorPage } from "@/pages/Calculator";
import { ContentPage } from "@/pages/Content";
import { WebsitePage } from "@/pages/Website";
import { WebsitesPage } from "@/pages/Websites";
import { TasksPage } from "@/pages/Tasks";
import { TimeClockPage } from "@/pages/TimeClock";
import { TimeOffPage } from "@/pages/TimeOff";
import { VideoCalculatorPage } from "@/pages/VideoCalculator";

function App() {
  const state = useUser();
  const user = state.status === "authenticated" ? state.user : null;
  const updateReady = useAppVersion();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {updateReady && <UpdateBanner />}
      <Header user={user} />
      <TeamNav user={user} />

      <main className="flex-1 flex flex-col items-center px-3 sm:px-6 py-6 sm:py-12">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/website" component={WebsitePage} />
          <Route path="/websites" component={WebsitesPage} />
          <Route path="/calculator" component={CalculatorPage} />
          <Route path="/video-calculator" component={VideoCalculatorPage} />
          <Route path="/content" component={ContentPage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/requests" component={RequestsPage} />
          <Route path="/time-clock" component={TimeClockPage} />
          <Route path="/time-off" component={TimeOffPage} />
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
          <Route path="/admin/time-clock">
            <AdminLayout>
              <AdminTimeClock />
            </AdminLayout>
          </Route>
          <Route path="/admin/time-off">
            <AdminLayout>
              <AdminTimeOff />
            </AdminLayout>
          </Route>
          {/* /admin/content removed — content tracker is now a top-level team app
              at /content. Admins see the Settings tab there too. */}
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

function UpdateBanner() {
  return (
    <div className="bg-tmc-dark text-tmc-gold text-sm px-4 py-2 flex items-center justify-center gap-3">
      <span>A new version of the portal is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 bg-tmc-gold text-tmc-dark font-medium rounded-md px-3 py-1 hover:bg-tmc-gold-dark transition-colors"
      >
        <RefreshCw size={13} /> Update
      </button>
    </div>
  );
}

export default App;
