import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const execute=promisify(execFile);
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'resume-extract.py');
const pdfMime='application/pdf';
const docxMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
let active=0;

export async function previewResume({base64,mime,filename},privateRoot,{python=process.env.FORGERADAR_PYTHON||'python'}={}){
  if(active)throw new Error('A résumé is already being parsed. Try again shortly.');
  if(typeof base64!=='string'||base64.length>8_100_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('Invalid or oversized résumé upload');
  if(![pdfMime,docxMime].includes(mime)||typeof filename!=='string'||filename.length>180||!filename.toLowerCase().endsWith(mime===pdfMime?'.pdf':'.docx'))throw new Error('Upload a PDF or DOCX with a matching file type');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length>6_000_000||bytes.length<8||!(mime===pdfMime?bytes.subarray(0,5).toString()==='%PDF-':bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))))throw new Error('File content does not match a supported PDF or DOCX');
  const tempRoot=path.resolve(privateRoot,'private-temp');
  await mkdir(tempRoot,{recursive:true,mode:0o700});
  const directory=await mkdtemp(path.join(tempRoot,'resume-'));
  const extension=mime===pdfMime?'.pdf':'.docx';
  const localFile=path.join(directory,'upload'+extension);
  active++;
  try{
    await writeFile(localFile,bytes,{mode:0o600});
    const {stdout}=await execute(python,[script,localFile],{windowsHide:true,timeout:20000,maxBuffer:512000});
    const result=JSON.parse(stdout);
    if(result.error)throw new Error(result.error);
    return result;
  }catch(error){
    if(error.code==='ENOENT')throw new Error('Local Python parser is unavailable. Configure FORGERADAR_PYTHON and install the free pypdf and python-docx packages.');
    let parserError=null;try{parserError=JSON.parse(error.stdout||'').error;}catch{}
    if(parserError)throw new Error(parserError);
    throw new Error(error.killed?'Résumé parsing timed out':error.message.slice(0,250));
  }finally{
    const relative=path.relative(tempRoot,directory);
    if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unsafe temporary upload path');
    await rm(directory,{recursive:true,force:true});
    active--;
  }
}
