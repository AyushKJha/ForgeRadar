import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const sourceRoot=process.argv[2]?path.resolve(process.argv[2]):root;
const destinationRoot=process.argv[3]?path.resolve(process.argv[3]):path.join(sourceRoot,'data','backups');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const destination=path.join(destinationRoot,`${stamp}-${randomUUID().slice(0,8)}`);
const manifest={createdAt:new Date().toISOString(),format:1,files:[]};
const digest=data=>createHash('sha256').update(data).digest('hex');
const quoteSql=value=>`'${String(value).replaceAll("'","''")}'`;

async function addJsonState(){
  const source=path.join(sourceRoot,'data','state.json');
  const stat=await lstat(source);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('State file must be a regular file');
  const bytes=await readFile(source);
  JSON.parse(bytes.toString('utf8'));
  const relative='data/state.json';
  const output=path.join(destination,relative);
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,bytes,{flag:'wx',mode:0o600});
  manifest.files.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});
}

async function addProjectDatabases(){
  const projects=path.join(sourceRoot,'projects');
  let entries=[];
  try{entries=await readdir(projects,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const entry of entries){
    if(!entry.isDirectory()||!/^[a-f0-9-]{36}$/i.test(entry.name))continue;
    const relative=`projects/${entry.name}/data/app.sqlite`;
    const source=path.join(sourceRoot,relative);
    let stat;
    try{stat=await lstat(source);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(!stat.isFile()||stat.isSymbolicLink())throw new Error(`Project database is not a regular file: ${entry.name}`);
    const output=path.join(destination,relative);
    await mkdir(path.dirname(output),{recursive:true});
    const db=new DatabaseSync(source,{readOnly:true});
    try{db.exec(`VACUUM INTO ${quoteSql(output)}`);}finally{db.close();}
    const bytes=await readFile(output);
    manifest.files.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});
  }
}

try{
  await mkdir(destinationRoot,{recursive:true,mode:0o700});
  await mkdir(destination,{recursive:false,mode:0o700});
  await addJsonState();
  await addProjectDatabases();
  await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({backup:destination,files:manifest.files.length,verified:manifest.files.every(file=>Boolean(file.sha256))}));
}catch(error){console.error(`Backup failed: ${error.message}`);process.exitCode=1;}
