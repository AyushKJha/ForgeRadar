import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {previewResume} from './resume-parser.mjs';

const execute=promisify(execFile);
const bundled=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
const python=process.env.FORGERADAR_PYTHON||(existsSync(bundled)?bundled:'python');

test('local DOCX parsing offers evidence for review and removes the uploaded file',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-resume-test-'));
  try{
    const filename=path.join(directory,'sample.docx');
    await execute(python,['-c','from docx import Document; import sys; d=Document(); d.add_paragraph("Built an embedded systems project with Python and signal processing."); d.save(sys.argv[1])',filename],{windowsHide:true,timeout:10000});
    const bytes=await readFile(filename);
    const result=await previewResume({base64:bytes.toString('base64'),mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',filename:'resume.docx'},directory,{python});
    assert.equal(result.suggestions.domains.some(item=>item.value==='embedded_systems'),true);
    assert.equal(result.suggestions.languages.some(item=>item.value==='Python'),true);
    assert.equal(result.suggestions.languages.every(item=>item.verified===false),true);
    assert.deepEqual(await readdir(path.join(directory,'private-temp')),[]);
    await assert.rejects(previewResume({base64:bytes.toString('base64'),mime:'application/pdf',filename:'resume.pdf'},directory,{python}),/does not match/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('local PDF parsing keeps extracted skills unverified',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-pdf-test-'));
  try{
    const filename=path.join(directory,'resume.pdf');
    await execute(python,['-c','from reportlab.pdfgen import canvas; import sys; c=canvas.Canvas(sys.argv[1]); c.drawString(50,750,"Cybersecurity project using Python and threat detection"); c.save()',filename],{windowsHide:true,timeout:10000});
    const bytes=await readFile(filename);
    const result=await previewResume({base64:bytes.toString('base64'),mime:'application/pdf',filename:'resume.pdf'},directory,{python});
    assert.equal(result.suggestions.domains.some(item=>item.value==='cybersecurity'),true);
    assert.equal(result.suggestions.languages.find(item=>item.value==='Python').verified,false);
  }finally{await rm(directory,{recursive:true,force:true});}
});
