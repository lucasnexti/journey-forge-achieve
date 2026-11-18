import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResearchPermissions } from "@/hooks/useResearchPermissions";
import { AUDIENCES, type Audience } from "@/lib/research";
import { cn } from "@/lib/utils";
import ResearchDashboard from "@/components/research/ResearchDashboard";
import SurveysTab from "@/components/research/SurveysTab";
import ListsTab from "@/components/research/ListsTab";
import EmployeeBaseTab from "@/components/research/EmployeeBaseTab";
import SettingsTab from "@/components/research/SettingsTab";

export default function AdminPesquisas() {
  const [params, setParams] = useSearchParams();
  const { can, isAdmin } = useResearchPermissions();
  const audience: Audience = params.get("publico") === "clientes" ? "clientes" : "interno";
  const tabs = [
    can("indicators_view") && { v: "dashboard", l: "Dashboard" },
    { v: "pesquisas", l: "Pesquisas" },
    (can("lists_import") || can("surveys_send")) && { v: "listas", l: "Listas de presença" },
    can("lists_import") && { v: "base", l: "Base de colaboradores" },
    { v: "config", l: "Configurações" },
  ].filter(Boolean) as { v: string; l: string }[];
  const tab = tabs.some((t) => t.v === params.get("aba")) ? params.get("aba")! : tabs[0].v;
  const update = (k: string, v: string) => { const n = new URLSearchParams(params); n.set(k, v); setParams(n, { replace: true }); };

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-primary">Pesquisas e Indicadores</h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
          <p className="mt-3 text-sm text-muted-foreground">NPS, CSAT e pesquisas personalizadas, listas de presença, convites e resultados — separados por público.</p>
        </div>
        <div role="radiogroup" aria-label="Público" className="inline-flex rounded-lg border border-border bg-card p-1">
          {AUDIENCES.map((a) => (
            <button key={a.value} role="radio" aria-checked={audience === a.value} onClick={() => update("publico", a.value)}
              className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", audience === a.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{a.label}</button>
          ))}
        </div>
      </header>
      <Tabs value={tab} onValueChange={(v) => update("aba", v)} className="mt-6">
        <TabsList className="h-auto flex-wrap justify-start">{tabs.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>)}</TabsList>
        <TabsContent value="dashboard" className="pt-4">{tab === "dashboard" && <ResearchDashboard key={audience} audience={audience} />}</TabsContent>
        <TabsContent value="pesquisas" className="pt-4"><SurveysTab key={audience} audience={audience} can={can} /></TabsContent>
        <TabsContent value="listas" className="pt-4">{tab === "listas" && <ListsTab key={audience} audience={audience} canImport={can("lists_import")} />}</TabsContent>
        <TabsContent value="base" className="pt-4">{tab === "base" && <EmployeeBaseTab key={audience} audience={audience} canImport={can("lists_import")} />}</TabsContent>
        <TabsContent value="config" className="pt-4">{tab === "config" && <SettingsTab canManage={can("settings_manage")} isAdmin={isAdmin} />}</TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
