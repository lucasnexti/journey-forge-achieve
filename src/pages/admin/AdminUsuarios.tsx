import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Search, UserCircle, Mail, Building2, Briefcase } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  cpf: string | null;
  empresa: string | null;
  cargo: string | null;
  created_at: string;
}

const AdminUsuarios = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setProfiles(data);
    setLoading(false);
  };

  const filtered = profiles.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.empresa?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.cargo?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.cpf?.includes(search) ?? false)
  );

  return (
    <AdminLayout>
      <h1 className="font-display text-xl font-bold text-primary">Usuários</h1>
      <div className="mt-1 h-1 w-12 rounded-full bg-gradient-nexti" />
      <p className="mt-3 text-sm text-muted-foreground">
        {profiles.length} usuário(s) cadastrado(s) na plataforma.
      </p>

      {/* Search */}
      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, empresa, cargo ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="mt-6 card-surface overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/50">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">CPF</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Cargo</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{p.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground tabular-nums">{p.cpf || "—"}</td>
                    <td className="px-5 py-4">
                      {p.empresa ? (
                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {p.empresa}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {p.cargo ? (
                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" /> {p.cargo}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm tabular-nums text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsuarios;
