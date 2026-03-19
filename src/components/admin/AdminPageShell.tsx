import AdminLayout from "@/components/admin/AdminLayout";

interface AdminPageShellProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

const AdminPageShell = ({ title, description, children }: AdminPageShellProps) => (
  <AdminLayout>
    <h1 className="font-display text-xl font-bold text-primary">{title}</h1>
    <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
    <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    {children || (
      <div className="mt-8 card-surface p-12 text-center">
        <p className="text-muted-foreground text-sm">Esta funcionalidade será implementada em breve.</p>
      </div>
    )}
  </AdminLayout>
);

export default AdminPageShell;
