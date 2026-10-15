export function githubUsername(input){
  let url;try{url=new URL(input);}catch{throw new Error('Enter a public GitHub profile URL');}
  if(url.protocol!=='https:'||url.hostname!=='github.com'||url.username||url.password||url.port||url.search||url.hash)throw new Error('Use an HTTPS github.com profile URL without parameters');
  const parts=url.pathname.split('/').filter(Boolean);
  if(parts.length!==1||!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(parts[0]))throw new Error('Enter a GitHub user profile, not a repository or internal URL');
  return parts[0];
}

export async function previewGithubPortfolio(input,{cache,fetchImpl=fetch}={}){
  const username=githubUsername(input),key='portfolio:github:'+username.toLowerCase();
  const cached=cache?.getCache(key);if(cached)return {...cached.payload,cached:true};
  const url=new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
  url.searchParams.set('type','owner');url.searchParams.set('sort','updated');url.searchParams.set('per_page','30');
  try{
    const response=await fetchImpl(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'ForgeRadar-local-portfolio','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(response.status===403||response.status===429?'GitHub public API rate limit reached':`GitHub returned HTTP ${response.status}`);
    const items=await response.json();if(!Array.isArray(items))throw new Error('Unexpected GitHub response');
    const repositories=items.filter(item=>item.private===false&&item.owner?.login?.toLowerCase()===username.toLowerCase()).slice(0,30).map(item=>({id:Number(item.id),name:String(item.name||'').slice(0,120),url:`https://github.com/${username}/${encodeURIComponent(item.name)}`,description:String(item.description||'').slice(0,300),language:String(item.language||'').slice(0,50),updatedAt:item.updated_at||null,fork:Boolean(item.fork)}));
    const result={username,repositories,retrievedAt:new Date().toISOString(),ownershipVerified:false,publicOnly:true};
    cache?.putCache(key,'github',result,3600000,response.headers?.get?.('etag')||null);
    return result;
  }catch(error){const stale=cache?.getCache(key,{allowStale:true});if(stale)return {...stale.payload,cached:true,stale:true,error:error.message};throw error;}
}
