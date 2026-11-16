import json, os, re, subprocess, concurrent.futures as cf, glob
AGW=os.environ["AGW_URL"]; TOK=os.environ["AGW_TOKEN"]
secmap={}
for f in glob.glob("sec/*.json"):
    d=json.load(open(f))["data"]; url=d.get("metadata",{}).get("sourceURL") or d.get("metadata",{}).get("url")
    md=d.get("markdown","")
    for l in d.get("links",[]):
        if "/kb/article/" in l: secmap.setdefault(l,set()).add(url)
def scrape(u):
    out=subprocess.run(["curl","-sS","--max-time","60",f"{AGW}/f/website-fetch/v2/scrape","-H",f"Authorization: Bearer {TOK}","-H","Content-Type: application/json","--data",json.dumps({"url":u,"formats":["markdown","rawHtml"],"maxAge":0})],capture_output=True,text=True).stdout
    d=json.loads(out)["data"]; md=d["markdown"]; html=d.get("rawHtml","")
    lines=[x for x in md.splitlines() if x.strip()]
    i=next(k for k,x in enumerate(lines) if "kb/article/undefined" in x)
    title=lines[i+1].strip()
    drive=sorted(set(re.findall(r'https://drive\.google\.com/file/d/([A-Za-z0-9_-]+)',html)))
    other=sorted(set(re.findall(r'https?://(?:www\.)?(?:youtube|youtu\.be|vimeo)[^"\s)]+',html)))
    body="\n".join(lines[i+2:lines.index("* * *",i) if "* * *" in lines[i:] else i+6])
    return {"url":u,"slug":u.rsplit("/",1)[1],"title":title,"drive":drive,"video":other[:3],"body":body[:500],"sections":sorted(secmap.get(u,[]))}
arts=[l.strip() for l in open("all_articles.txt")]
with cf.ThreadPoolExecutor(8) as ex: res=list(ex.map(scrape,arts))
json.dump(res,open("articles.json","w"),ensure_ascii=False,indent=1)
for r in res: print(r["slug"][:45].ljust(46), len(r["drive"]), r["title"][:50], "|", ",".join(s.rsplit('/',1)[1] for s in r["sections"])[:40], "VIDEO" if r["video"] else "")
