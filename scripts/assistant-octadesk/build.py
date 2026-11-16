import json, re, subprocess, collections
arts=json.load(open("articles.json"))
# Orientations (Nexti na Prática, published copy)
src=subprocess.run(["node","-e",'global.window={};eval(require("fs").readFileSync("/dev-server/public/nexti-na-pratica/dados.js","utf8"));console.log(JSON.stringify(window.DADOS.orientacoes))'],capture_output=True,text=True).stdout
oris={o["id"]:o for o in json.loads(src) if o.get("status")=="publicado"}
MANUAL={"guia-cadastro-horario-e-escala-completo":["ori-0001"],"cadastro-de-feriado":["ori-0002"],"guia-cadastro-biometria-e-senha-completo":["ori-0003"],
"https-drive-google-com-file-d-1qfakm-508uscgzhhnyr8ozjlssh1ih4y-view-usp-sharing":["ori-0004"],"tipos-de-usuario":["ori-0005"],
"guia-dashboard-completo":["ori-0006","ori-0007"],"req":["ori-0008"],"mesa-de-operacao-completo":["ori-0009"],"cadastro-e-lancamento-de-ausencia":["ori-0010"],
"gestao-de-trocas-e-coberturas":["ori-0011"],"ajuste-de-inconsistencias-em-lote":["ori-0012"],"inconsistencias":["ori-0013"],
"modulo-de-ausencia-em-lote":["ori-0014"],"modulo-troca-de-horario-em-lote":["ori-0015"]}
art2ori=collections.defaultdict(list); used=set()
for slug,ids in MANUAL.items():
    for i in ids: art2ori[slug].append(i); used.add(i)
for o in oris.values():
    if o["id"] in used: continue
    arts_o=(o.get("origem") or {}).get("artigos") or []
    if arts_o:
        slug=arts_o[0]["url"].rsplit("/",1)[1]; art2ori[slug].append(o["id"]); used.add(o["id"])
def opath(o):
    sub=(o.get("submodulos") or [None])[0]
    return f"{o['modulo']}/{sub}/{o['slug']}" if sub else None
def otext(o):
    parts=[o["titulo"]]
    if o.get("resumo"): parts.append(o["resumo"])
    if o.get("finalidade"): parts.append("Finalidade: "+o["finalidade"])
    if o.get("preparacao"): parts.append("Antes de começar: "+" ".join(o["preparacao"]))
    for i,p in enumerate(o.get("resumoProcedimento") or [],1): parts.append(f"{i}. {p.get('titulo','')}: {p.get('texto','')}")
    for i,p in enumerate(o.get("passos") or [],1):
        parts.append(f"Passo {i}: "+(p if isinstance(p,str) else " ".join(str(v) for v in p.values() if isinstance(v,str))))
    for a in o.get("atencao") or []: parts.append("Atenção: "+(a if isinstance(a,str) else json.dumps(a,ensure_ascii=False)))
    for t in o.get("telas") or []:
        for im in t.get("imagens") or []:
            if im.get("legenda"): parts.append(f"Tela ({t.get('aba','')}): {im['legenda']}")
    return "\n".join(parts)
SCRUB=[(re.compile(r'[\w.%+-]+@[\w.-]+\.[a-z]{2,}'),"[e-mail]"),(re.compile(r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b'),"[CPF]"),
       (re.compile(r'\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b'),"[CNPJ]"),(re.compile(r'\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b'),"[telefone]")]
def clean(t):
    t=t.replace("\ufb01","fi").replace("\ufb02","fl").replace("\x0c"," ")
    lines=[l.strip() for l in t.splitlines()]
    lines=[l for l in lines if l and l.upper() not in ("MENU","GUIA","RÁPIDO","GUIA RÁPIDO") and not re.fullmatch(r'[\d\s.]+',l)]
    t=re.sub(r'[ \t]+',' '," ".join(lines)); t=re.sub(r'\bMENU\b','',t); t=re.sub(r'\s{2,}',' ',t)
    t=re.sub(r'(?:\.\s?){4,}',' ',t)
    for r,s in SCRUB: t=r.sub(s,t)
    return t.strip()
MODULE={"talent":"talent"}
out=[]; report=[]
for a in arts:
    if not a["drive"]: report.append((a["title"],"vídeo, não incluído",0)); continue
    pdf=f"pdf/{a['slug'][:60]}.pdf"
    n=int(re.search(r'Pages:\s+(\d+)',subprocess.run(["pdfinfo",pdf],capture_output=True,text=True).stdout).group(1))
    chunks=[]; buf=[]; start=None; words=0
    def flush(end):
        global buf,start,words
        if buf: chunks.append({"section":f"Páginas {start}–{end}" if start!=end else f"Página {start}","content":"\n".join(buf)})
        buf=[]; start=None; words=0
    empty=0
    for p in range(1,n+1):
        t=clean(subprocess.run(["pdftotext","-enc","UTF-8","-raw","-f",str(p),"-l",str(p),pdf,"-"],capture_output=True,text=True).stdout)
        w=len(t.split())
        if w<4: empty+=1; continue
        if start is None: start=p
        buf.append(t); words+=w
        if words>=220: flush(p)
    flush(n)
    # fix last section label end page
    sec=[s.rsplit('/',1)[1] for s in a["sections"]]
    module="talent" if "talent" in sec else "nexti"
    o_ids=art2ori.get(a["slug"],[])
    link=None
    if len(o_ids)==1 and opath(oris[o_ids[0]]): link=(opath(oris[o_ids[0]]),oris[o_ids[0]]["titulo"])
    rows=[{"section":c["section"],"content":c["content"],"orientation_path":None,"orientation_title":None} for c in chunks]
    for oid in o_ids:
        o=oris[oid]; txt=otext(o)
        for k in range(0,len(txt),1800):
            rows.append({"section":"Orientação no Nexti na Prática: "+o["titulo"],"content":txt[k:k+1900],"orientation_path":opath(o),"orientation_title":o["titulo"]})
    unp=[{"type":"pdf","section":"PDF","detail":f"{empty} página(s) sem texto legível (só imagem)"}] if empty else []
    out.append({"page_id":"octadesk:"+a["slug"],"title":a["title"],"url":a["url"],"module":module,"position":len(out),
      "linked_orientation_path":link[0] if link else None,"linked_orientation_title":link[1] if link else None,"unprocessed":unp,"chunks":rows})
    report.append((a["title"],f"{n} págs, {len(chunks)} trechos do PDF, {len(o_ids)} orientações, {empty} sem texto",len(rows)))
json.dump(out,open("octadesk_index.json","w"),ensure_ascii=False)
for r in report: print(r)
print(sum(len(x["chunks"]) for x in out),"chunks;", len(out),"sources")
