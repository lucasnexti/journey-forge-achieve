import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/passwordPolicy";

const PasswordChecklist = ({ password }: { password: string }) => (
  <ul className="mt-2 space-y-1 text-xs">
    {PASSWORD_RULES.map((r) => {
      const ok = r.test(password);
      return (
        <li key={r.key} className={`flex items-center gap-1.5 ${ok ? "text-green-600" : "text-muted-foreground"}`}>
          {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {r.label}
        </li>
      );
    })}
  </ul>
);
export default PasswordChecklist;
