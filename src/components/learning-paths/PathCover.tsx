import { Route } from 'lucide-react';
export default function PathCover({url,name}: {url?: string;name: string}) {
  return <div className="aspect-[16/7] w-full overflow-hidden bg-primary/5 flex items-center justify-center border-b border-border">
    {url ? <img src={url} alt={name} className="h-full w-full object-contain" /> : <div className="flex items-center gap-3 text-primary"><Route className="h-10 w-10"/><span className="text-xl font-semibold">Nexti Academy</span></div>}
  </div>;
}