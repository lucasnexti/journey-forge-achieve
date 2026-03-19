import { useRef } from "react";
import { GraduationCap, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CertificateProps {
  userName: string;
  trackTitle: string;
  completedAt: string;
  score: number;
}

const Certificate = ({ userName, trackTitle, completedAt, score }: CertificateProps) => {
  const certRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !certRef.current) return;
    printWindow.document.write(`
      <html><head><title>Certificado - ${trackTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8faf9; }
        .cert { width: 800px; padding: 64px; border: 2px solid #004d40; background: white; text-align: center; }
        .cert h1 { font-size: 14px; letter-spacing: 0.2em; text-transform: uppercase; color: #004d40; margin-bottom: 32px; }
        .cert h2 { font-size: 28px; color: #111; margin-bottom: 8px; }
        .cert .name { font-size: 36px; font-weight: 700; color: #004d40; margin: 24px 0; }
        .cert p { color: #666; font-size: 14px; line-height: 1.8; }
        .cert .footer { margin-top: 48px; display: flex; justify-content: space-between; border-top: 1px solid #e0e0e0; padding-top: 24px; }
        .cert .footer div { text-align: center; }
        .cert .footer .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; }
        .cert .footer .value { font-size: 14px; font-weight: 600; color: #333; margin-top: 4px; }
        @media print { body { background: white; } }
      </style></head><body>
      <div class="cert">
        <h1>Universidade Cooperativa</h1>
        <h2>Certificado de Conclusão</h2>
        <p>Certificamos que</p>
        <div class="name">${userName}</div>
        <p>concluiu com aproveitamento a trilha</p>
        <p style="font-weight: 600; color: #333; font-size: 18px; margin-top: 8px;">"${trackTitle}"</p>
        <div class="footer">
          <div><div class="label">Data</div><div class="value">${new Date(completedAt).toLocaleDateString('pt-BR')}</div></div>
          <div><div class="label">Nota</div><div class="value">${score}%</div></div>
          <div><div class="label">Código</div><div class="value">${Date.now().toString(36).toUpperCase()}</div></div>
        </div>
      </div>
      <script>setTimeout(() => window.print(), 500);</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="card-surface overflow-hidden">
      <div ref={certRef} className="border-2 border-primary/20 bg-card p-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Universidade Cooperativa
        </p>
        <h2 className="mt-2 font-display text-xl font-bold text-foreground">
          Certificado de Conclusão
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">Certificamos que</p>
        <p className="mt-1 font-display text-2xl font-bold text-primary">{userName}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          concluiu a trilha <strong className="text-foreground">"{trackTitle}"</strong>
        </p>
        <div className="mt-6 flex justify-center gap-8 text-center">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Data</p>
            <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">
              {new Date(completedAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Nota</p>
            <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">{score}%</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <Button onClick={handlePrint} variant="outline" className="w-full gap-2">
          <Printer className="h-4 w-4" />
          Imprimir / Salvar PDF
        </Button>
      </div>
    </div>
  );
};

export default Certificate;
