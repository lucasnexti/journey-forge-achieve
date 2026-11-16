# Builds the assistant index for the "Manuais de implantação Nexti" site (https://manuais-nexti.pages.dev/).
# Usage (from a work dir): python3 build.py Admissão  -> downloads manuais.json + PDFs, writes manuais_index.json
# Upload the result to the private assistant-knowledge bucket as manuais/index.json, then run
# "Importar manuais" in Admin > Assistente IA. Only the PDFs' text is read (no OCR of screenshots: may show personal data).
import json, re, subprocess, sys, os, datetime
SITE = "https://manuais-nexti.pages.dev/"
GROUPS = {"Admissão": "admissao", "Talent": "talent", "Nexti": "nexti"}
wanted = sys.argv[1:] or ["Admissão"]
os.makedirs("pdf", exist_ok=True)
subprocess.run(["curl", "-sS", "--fail", "-o", "manuais.json", SITE + "manuais.json"], check=True)
base = json.load(open("manuais.json"))
SCRUB = [(re.compile(r'[\w.%+-]+@[\w.-]+\.[a-z]{2,}'), "[e-mail]"), (re.compile(r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b'), "[CPF]"),
         (re.compile(r'\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b'), "[CNPJ]"), (re.compile(r'\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b'), "[telefone]")]
def clean(t):
    t = t.replace("\ufb01", "fi").replace("\ufb02", "fl").replace("\x0c", " ").replace("●", "\n•")
    lines = [l.strip() for l in t.splitlines()]
    lines = [l for l in lines if l and not re.fullmatch(r'[\d\s.]+', l) and l not in ("Nexti Admissão", "FIM!")]
    t = re.sub(r'[ \t]+', ' ', "\n".join(lines))
    t = re.sub(r'(Passo \d{2})', r'\n\1', t)
    for r, s in SCRUB: t = r.sub(s, t)
    return re.sub(r'\n{2,}', '\n', t).strip()
def plain(s): return re.sub(r'\*\*(.+?)\*\*', r'\1', s)
out = []; report = []
for g in base["grupos"]:
    if g["nome"] not in wanted: continue
    module = GROUPS[g["nome"]]
    for s in g["secoes"]:
        for a in s["artigos"]:
            url = SITE + "?manual=" + a["id"]
            rows, unp = [], []
            intro = [f"Manual: {a['titulo']} (assunto: {s['titulo']}, produto {g['nome']})."]
            if a.get("boasPraticas"): intro.append("Boas práticas: " + " ".join(plain(b) for b in a["boasPraticas"]))
            if a.get("desafios"):
                d = a["desafios"]; intro.append("Desafios: " + " ".join(d.get("perguntas") or []) + " " + plain(d.get("resposta") or ""))
            rows.append({"section": "Resumo e boas práticas", "content": "\n".join(intro)})
            npages = 0
            if a["urlBaixar"].endswith(".pdf"):
                pdf = f"pdf/{a['id']}.pdf"
                subprocess.run(["curl", "-sS", "--fail", "-o", pdf, SITE + a["urlBaixar"]], check=True)
                npages = int(re.search(r'Pages:\s+(\d+)', subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
                buf, start, words, empty = [], None, 0, 0
                def flush(end):
                    global buf, start, words
                    if buf: rows.append({"section": f"Páginas {start}–{end}" if start != end else f"Página {start}",
                                         "content": f"{a['titulo']} ({g['nome']})\n" + "\n".join(buf)})
                    buf, start, words = [], None, 0
                for p in range(1, npages + 1):
                    t = clean(subprocess.run(["pdftotext", "-enc", "UTF-8", "-raw", "-f", str(p), "-l", str(p), pdf, "-"],
                                             capture_output=True, text=True).stdout)
                    w = len(t.split())
                    if w < 3: empty += 1; continue
                    if start is None: start = p
                    buf.append(t); words += w
                    if words >= 200: flush(p)
                flush(npages)
                if empty: unp.append({"type": "pdf", "section": "PDF", "detail": f"{empty} página(s) sem texto legível (só imagem)"})
            else:
                unp.append({"type": "video", "section": "Vídeo", "detail": "Vídeo não analisado; só o texto da página foi usado"})
            for r in rows: r.update(orientation_path=None, orientation_title=None)
            out.append({"page_id": "manuais:" + a["id"], "title": a["titulo"], "url": url, "module": module, "position": len(out),
                        "linked_orientation_path": None, "linked_orientation_title": None, "unprocessed": unp, "chunks": rows})
            report.append((a["titulo"], npages, len(rows)))
json.dump({"source": SITE, "generated_at": base.get("geradoEm") or datetime.datetime.utcnow().isoformat() + "Z", "articles": out},
          open("manuais_index.json", "w"), ensure_ascii=False)
for r in report: print(r)
print(sum(len(x["chunks"]) for x in out), "chunks;", len(out), "manuais")
