import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADMIN_REPORT_TYPES, resolveAdminReportType, type AdminReportType } from "@/lib/adminReportTypes";

const reportViews = {
  td: lazy(() => import("./AdminRelatoriosTD")),
  progress: lazy(() => import("./AdminRelatorioProgresso")),
} satisfies Record<AdminReportType, React.ComponentType<{ embedded?: boolean }>>;

export default function AdminRelatorios() {
  const [params, setParams] = useSearchParams();
  const type = resolveAdminReportType(params.get("tipo"));
  const Report = reportViews[type];
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-xl font-bold text-primary">Relatórios</h1>
        <div className="w-full space-y-2 sm:max-w-sm">
          <Label htmlFor="report-type">Tipo de relatório</Label>
          <Select value={type} onValueChange={value => setParams({ tipo: resolveAdminReportType(value) })}>
            <SelectTrigger id="report-type"><SelectValue /></SelectTrigger>
            <SelectContent>{ADMIN_REPORT_TYPES.map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Suspense fallback={<p role="status" className="py-8 text-muted-foreground">Carregando relatório…</p>}>
          <Report key={type} embedded />
        </Suspense>
      </div>
    </AdminLayout>
  );
}