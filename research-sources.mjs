import {createHash} from 'node:crypto';

const providers={
  openalex:{base:'https://api.openalex.org/works',ttlMs:86400000},
  crossref:{base:'https://api.crossref.org/works',ttlMs:86400000}
};
const text=(value,max=600)=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const date=value=>{if(!value)return null;const parsed=Date.parse(value);return Number.isFinite(parsed)?new Date(parsed).toISOString():null;};
const id=(provider,canonical)=>createHash('sha256').update(provider+'|'+canonical).digest('hex').slice(0,24);
const validQuery=value=>typeof value==='string'&&value.trim().length>=2&&value.length<=120&&/^[\p{L}\p{N}\s/,+.()_-]+$/u.test(value);

export function normalizeOpenAlex(work,retrievedAt){
  const canonical=typeof work?.id==='string'&&/^https:\/\/openalex\.org\/W\d+$/.test(work.id)?work.id:null;
  const title=text(work?.display_name,240);
  if(!canonical||!title)return null;
  const authors=(work.authorships||[]).slice(0,5).map(a=>text(a.author?.display_name,100)).filter(Boolean);
  const publishedAt=date(work.publication_date);
  let excerpt='';
  if(work.abstract_inverted_index&&typeof work.abstract_inverted_index==='object'){
    const words=[];for(const [word,positions] of Object.entries(work.abstract_inverted_index))for(const position of positions)if(Number.isInteger(position)&&position>=0&&position<1000)words[position]=word;
    excerpt=text(words.filter(Boolean).join(' '),500);
  }
  return {id:id('openalex',canonical),provider:'OpenAlex',sourceTitle:title,canonicalUrl:canonical,authors,publishedAt,retrievedAt,excerpt,sourceType:'research paper',verifiedSource:true,proposal:false,publicationDateKnown:!!publishedAt};
}

export function normalizeCrossref(work,retrievedAt){
  const doi=typeof work?.DOI==='string'?work.DOI.toLowerCase():'';
  if(!/^10\.\d{4,9}\/[a-z0-9._;()/:+-]+$/i.test(doi))return null;
  const canonical='https://doi.org/'+doi;
  const title=text(work.title?.[0],240);
  if(!title)return null;
  const parts=work.published?.['date-parts']?.[0]||work['published-online']?.['date-parts']?.[0]||work['published-print']?.['date-parts']?.[0];
  const publishedAt=Array.isArray(parts)&&Number.isInteger(parts[0])?date(`${parts[0]}-${String(parts[1]||1).padStart(2,'0')}-${String(parts[2]||1).padStart(2,'0')}`):null;
  const authors=(work.author||[]).slice(0,5).map(a=>text([a.given,a.family].filter(Boolean).join(' '),100)).filter(Boolean);
  return {id:id('crossref',canonical),provider:'Crossref',sourceTitle:title,canonicalUrl:canonical,authors,publishedAt,retrievedAt,excerpt:text(work.abstract,500),sourceType:work.type||'research work',verifiedSource:true,proposal:false,publicationDateKnown:!!publishedAt};
}

export async function collectResearch({query,enabled=[],cache,fetchImpl=fetch,now=()=>Date.now()}){
  if(!validQuery(query))throw new Error('Use a short research query containing letters or numbers');
  const selected=[...new Set(enabled)].filter(name=>Object.hasOwn(providers,name));
  const results=[],health=[];
  for(const name of selected){
    const key=`research:${name}:${createHash('sha256').update(query.toLowerCase().trim()).digest('hex').slice(0,32)}`;
    const cached=cache?.getCache(key);
    if(cached){results.push(...cached.payload);health.push({id:name,status:'cached',count:cached.payload.length,lastSuccess:cached.fetchedAt});continue;}
    const config=providers[name],url=new URL(config.base);
    if(name==='openalex'){url.searchParams.set('search',query);url.searchParams.set('per-page','5');url.searchParams.set('select','id,display_name,publication_date,authorships,abstract_inverted_index');}
    else{url.searchParams.set('query.title',query);url.searchParams.set('rows','5');url.searchParams.set('select','DOI,title,author,published,published-online,published-print,abstract,type');}
    try{
      const response=await fetchImpl(url,{headers:{'User-Agent':'ForgeRadar/3 (local research; no bulk crawling)','Accept':'application/json'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();const retrievedAt=new Date(now()).toISOString();
      const works=name==='openalex'?payload.results:payload.message?.items;
      if(!Array.isArray(works))throw new Error('Unexpected source response');
      const normalized=works.slice(0,5).map(work=>name==='openalex'?normalizeOpenAlex(work,retrievedAt):normalizeCrossref(work,retrievedAt)).filter(Boolean);
      cache?.putCache(key,name,normalized,config.ttlMs,response.headers?.get?.('etag')||null);
      results.push(...normalized);health.push({id:name,status:'connected',count:normalized.length,lastSuccess:retrievedAt});
    }catch(error){
      const stale=cache?.getCache(key,{allowStale:true});
      if(stale){results.push(...stale.payload.map(item=>({...item,cachedOffline:true})));health.push({id:name,status:'stale',count:stale.payload.length,error:error.message,lastSuccess:stale.fetchedAt});}
      else health.push({id:name,status:'error',count:0,error:error.message});
    }
  }
  return {results:[...new Map(results.map(result=>[result.canonicalUrl,result])).values()],health};
}
