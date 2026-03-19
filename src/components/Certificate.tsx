import { useRef } from "react";
import { Printer } from "lucide-react";
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
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #faf8f6; }
        .cert { width: 800px; padding: 64px; border: 3px solid #E84E1B; background: white; text-align: center; position: relative; overflow: hidden; }
        .cert::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #E84E1B, #F5A623); }
        .cert h1 { font-size: 14px; letter-spacing: 0.2em; text-transform: uppercase; color: #E84E1B; margin-bottom: 32px; font-weight: 800; }
        .cert h2 { font-size: 28px; color: #222; margin-bottom: 8px; }
        .cert .name { font-size: 36px; font-weight: 800; color: #E84E1B; margin: 24px 0; }
        .cert p { color: #666; font-size: 14px; line-height: 1.8; }
        .cert .footer { margin-top: 48px; display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 24px; }
        .cert .footer div { text-align: center; }
        .cert .footer .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; }
        .cert .footer .value { font-size: 14px; font-weight: 600; color: #333; margin-top: 4px; }
        @media print { body { background: white; } }
      </style></head><body>
      <div class="cert">
        <h1>Universidade Nexti · Cooperativa</h1>
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
      <div ref={certRef} className="relative border-2 border-primary/20 bg-card p-8 text-center overflow-hidden">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-nexti" />

        <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Universidade Nexti · Cooperativa
        </p>
        <h2 className="mt-2 font-display text-xl font-bold text-foreground">
          Certificado de Conclusão
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">Certificamos que</p>
        <p className="mt-1 font-display text-2xl font-extrabold text-gradient-nexti">{userName}</p>
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
