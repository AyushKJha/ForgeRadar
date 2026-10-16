import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const previewPort=Number(process.env.FORGERADAR_ECLIPSE_PREVIEW_PORT||4318);
const primaryPort=4317;
const primaryHost='127.0.0.1:'+primaryPort;
const allowedHosts=new Set(['127.0.0.1:'+previewPort,'localhost:'+previewPort]);
const loopbackPeers=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);

export const previewServer=http.createServer(async(req,res)=>{
  const host=String(req.headers.host||'').toLowerCase();
  if(!allowedHosts.has(host)||!loopbackPeers.has(req.socket.remoteAddress)){
    res.writeHead(403,{'Content-Type':'text/plain'});res.end('Local preview only');return;
  }
  const requestUrl=new URL(req.url,'http://'+host);
  if(req.method==='GET'&&requestUrl.pathname==='/'&&requestUrl.search===''){
    try{
      const html=await readFile(path.join(root,'public','local-login.html'),'utf8');
      const themed=html.replace('</head>','  <link rel="stylesheet" href="/eclipse-preview.css">\n</head>');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});
      res.end(themed);
    }catch{res.writeHead(500);res.end('Preview unavailable');}
    return;
  }
  if(req.method==='GET'&&requestUrl.pathname==='/eclipse-preview.css'){
    try{const css=await readFile(path.join(root,'public','eclipse-preview.css'));res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(css);}
    catch{res.writeHead(500);res.end('Preview stylesheet unavailable');}
    return;
  }
  const origin=String(req.headers.origin||'');
  if(origin&&!allowedHosts.has(origin.replace(/^https?:\/\//,'').toLowerCase())){res.writeHead(403);res.end('Origin rejected');return;}
  const headers={...req.headers,host:primaryHost};
  delete headers.connection;
  if(origin)headers.origin='http://'+primaryHost;
  const upstream=http.request({hostname:'127.0.0.1',port:primaryPort,path:req.url,method:req.method,headers},upstreamRes=>{
    res.writeHead(upstreamRes.statusCode||502,upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain'});res.end('Start the main ForgeRadar service on port 4317 first.');});
  req.pipe(upstream);
});

if(process.argv[1]===fileURLToPath(import.meta.url)){
  previewServer.listen(previewPort,'127.0.0.1',()=>console.log('Eclipse comparison ready at http://127.0.0.1:'+previewPort));
}
