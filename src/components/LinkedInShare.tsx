import { Linkedin, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LinkedInShareProps {
  type: "certificate" | "badge";
  title: string;
  description?: string;
  issuerName?: string;
  issuedAt?: string;
  certificateCode?: string;
  compact?: boolean;
}

const ORGANIZATION_NAME = "Universidade Nexti";
const ORGANIZATION_URL = "https://nexti.com";

const LinkedInShare = ({
  type,
  title,
  description,
  issuerName = ORGANIZATION_NAME,
  issuedAt,
  certificateCode,
  compact = false,
}: LinkedInShareProps) => {
  const shareAsPost = () => {
    const text =
      type === "certificate"
        ? `🎓 Acabei de concluir a trilha "${title}" na ${issuerName}!\n\n${description ? description + "\n\n" : ""}${certificateCode ? `Código de verificação: ${certificateCode}\n\n` : ""}#Aprendizado #DesenvolvimentoProfissional #${issuerName.replace(/\s/g, "")} #Certificação`
        : `🏆 Conquistei a insígnia "${title}" na ${issuerName}!\n\n${description ? description + "\n\n" : ""}#Gamificação #Aprendizado #${issuerName.replace(/\s/g, "")}`;

    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ORGANIZATION_URL)}&text=${encodeURIComponent(text)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer,width=600,height=600");
  };

  const addToProfile = () => {
    const params = new URLSearchParams();
    params.set("startTask", "CERTIFICATION_NAME");
    params.set("name", title);
    params.set("organizationName", issuerName);

    if (issuedAt) {
      const date = new Date(issuedAt);
      params.set("issueYear", String(date.getFullYear()));
      params.set("issueMonth", String(date.getMonth() + 1));
    }

    if (certificateCode) {
      params.set("certId", certificateCode);
      params.set("certUrl", `${ORGANIZATION_URL}/verificar/${certificateCode}`);
    }

    const linkedInUrl = `https://www.linkedin.com/profile/add?${params.toString()}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer,width=800,height=700");
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 transition-colors"
            title="Compartilhar no LinkedIn"
          >
            <Linkedin className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={shareAsPost} className="gap-2 cursor-pointer">
            <Share2 className="h-4 w-4" />
            Compartilhar como post
          </DropdownMenuItem>
          <DropdownMenuItem onClick={addToProfile} className="gap-2 cursor-pointer">
            <ExternalLink className="h-4 w-4" />
            Adicionar ao perfil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={shareAsPost}
        className="gap-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10"
      >
        <Linkedin className="h-4 w-4" />
        Compartilhar no LinkedIn
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={addToProfile}
        className="gap-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10"
      >
        <ExternalLink className="h-4 w-4" />
        Adicionar ao Perfil
      </Button>
    </div>
  );
};

export default LinkedInShare;
