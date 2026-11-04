import { useQuery } from '@tanstack/react-query';
import { Link,useParams } from 'react-router-dom';
import { ArrowLeft,ArrowRight,BookOpen,CheckCircle2,Lock,Route } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import PathCover from '@/components/learning-paths/PathCover';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { listPaths,pathSnapshot,pathProgress } from '@/lib/learningPaths';
export default function LearningPathsPage(){
  const {pathId} = useParams(); const {user} = useAuth();
  const query = useQuery({queryKey:['learning-paths',user?.id,pathId],queryFn:()=>pathId?pathSnapshot(pathId).then(p=>[p]):listPaths(),enabled:!!user,staleTime:0});
  const paths = query.data || []; const path = pathId?paths[0]:null;
  return <AppLayout><section className="learning-paths mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
    {pathId && <Button asChild variant="ghost"><Link to="/minhas-trilhas"><ArrowLeft/>Minhas trilhas</Link></Button>}
    <header><h1 className="text-2xl font-bold">{path?.name || 'Minhas trilhas'}</h1>{path && <p className="mt-2 text-muted-foreground break-words">{path.description}</p>}</header>
    {query.isLoading ? <p role="status">Carregando trilhas…</p> : query.isError ? <div role="alert" className="space-y-3"><p>Não foi possível abrir esta trilha. Ela pode estar indisponível ou sem autorização de acesso.</p><Button variant="outline" onClick={()=>query.refetch()}>Tentar novamente</Button></div> : !paths.length ? <div className="py-16 text-center space-y-3"><Route className="mx-auto h-10 w-10 text-primary"/><h2 className="text-lg font-semibold">Sua próxima jornada está a caminho</h2><p className="text-muted-foreground">Você ainda não tem trilhas disponíveis. Elas aparecerão aqui quando seu acesso for liberado.</p></div> : path ? <>
      <div className="flex flex-wrap items-center gap-4"><Badge variant="secondary">{path.progression==='sequential'?'Sequencial':'Livre'}</Badge><span>{path.courses.length} cursos</span><span>{pathProgress(path.courses).percent}% concluído</span></div>
      <Progress value={pathProgress(path.courses).percent}/>
      {path.categories.map(category=><section key={category} className="space-y-3"><h2 className="text-lg font-semibold">{category}</h2>{path.courses.filter(c=>c.category===category).map(c=>{
        const pending = path.courses.slice(0,c.position).filter(p=>!p.completed); return <article key={c.track_id} className="flex flex-col sm:flex-row gap-4 border-b border-border py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{c.completed?<CheckCircle2/>:!c.unlocked?<Lock/>:<BookOpen/>}</div>
          <div className="flex-1 min-w-0"><h3 className="font-semibold break-words">{c.position+1}. {c.title}</h3><p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>{!c.unlocked && <p className="mt-2 text-sm text-muted-foreground">{pending.length?`Conclua primeiro: ${pending.map(p=>p.title).join(', ')}.`:'Curso indisponível no momento.'}</p>}</div>
          {c.unlocked?<Button asChild variant={c.completed?'outline':'default'}><Link to={`/trilha/${c.track_id}`}>{c.completed?'Revisar':c.started?'Continuar':'Começar'}<ArrowRight/></Link></Button>:<Button disabled variant="outline"><Lock/>Bloqueado</Button>}
        </article>;
      })}</section>)}
    </> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{paths.map(p=>{const progress=pathProgress(p.courses);return <article key={p.id} className="rounded-lg border border-border overflow-hidden flex flex-col bg-card"><PathCover url={p.coverUrl} name={p.name}/><div className="p-5 flex-1 flex flex-col gap-3"><Badge variant="secondary" className="self-start">{progress.status}</Badge><h2 className="text-lg font-semibold break-words">{p.name}</h2><p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p><div className="mt-auto space-y-3"><div className="flex justify-between text-sm"><span>{p.courses.length} cursos</span><span>{progress.percent}%</span></div><Progress value={progress.percent}/><Button asChild className="w-full"><Link to={`/minhas-trilhas/${p.id}`}>{progress.status==='Concluída'?'Revisar':progress.status==='Em andamento'?'Continuar':'Começar'}<ArrowRight/></Link></Button></div></div></article>;})}</div>}
  </section></AppLayout>;
}