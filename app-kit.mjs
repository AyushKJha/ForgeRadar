import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const identifier=/^[a-z][a-z0-9_]{0,39}$/;
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const fieldSchema=object({name:{type:'string'},label:{type:'string'},type:{type:'string',enum:['text','number','date','boolean','select']},required:{type:'boolean'},options:{type:'array',maxItems:12,items:{type:'string',maxLength:80}}});
const entitySchema=object({name:{type:'string'},label:{type:'string'},fields:{type:'array',minItems:1,maxItems:10,items:fieldSchema}});
export const appSpecSchema=object({title:{type:'string',maxLength:180},description:{type:'string',maxLength:600},entities:{type:'array',minItems:1,maxItems:4,items:entitySchema}});
export function validateSpec(spec){
 if(!spec||typeof spec.title!=='string'||!spec.title.trim()||spec.title.length>180||typeof spec.description!=='string'||spec.description.length>600||!Array.isArray(spec.entities)||spec.entities.length<1||spec.entities.length>4)throw new Error('Invalid application definition');
 const entities=new Set();for(const entity of spec.entities){if(!identifier.test(entity.name)||entities.has(entity.name)||typeof entity.label!=='string'||!entity.label.trim()||entity.label.length>120||!Array.isArray(entity.fields)||!entity.fields.length||entity.fields.length>10)throw new Error('Invalid entity definition: '+String(entity.name).slice(0,40));entities.add(entity.name);const fields=new Set();for(const field of entity.fields){if(!identifier.test(field.name)||fields.has(field.name)||['id','createdAt','updatedAt','__proto__','constructor','prototype'].includes(field.name)||typeof field.label!=='string'||!field.label.trim()||field.label.length>120||!['text','number','date','boolean','select'].includes(field.type)||typeof field.required!=='boolean'||!Array.isArray(field.options)||field.options.length>12||field.options.some(x=>typeof x!=='string'||!x.trim()||x.length>80)||(field.type==='select'&&!field.options.length))throw new Error('Invalid field '+String(field.name).slice(0,40)+' in '+entity.name+': use a unique snake_case non-reserved name, valid type and nonempty options for selects.');fields.add(field.name);}}
 return JSON.parse(JSON.stringify(spec));
}
export function validateRecord(entity,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Supply a record object');const output={};
 if(Object.keys(input).some(k=>!entity.fields.some(f=>f.name===k)))throw new Error('Unknown record field');
 for(const f of entity.fields){const value=input[f.name];if(value===undefined||value===null||value===''){if(f.required)throw new Error(f.label+' is required');output[f.name]=null;continue;}if(f.type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error(f.label+' must be a finite number');if(Number.isFinite(f.min)&&(f.exclusiveMin?value<=f.min:value<f.min))throw new Error(f.label+' must be '+(f.exclusiveMin?'greater than ':'at least ')+f.min);if(Number.isFinite(f.max)&&value>f.max)throw new Error(f.label+' must be at most '+f.max);}else if(f.type==='boolean'){if(typeof value!=='boolean')throw new Error(f.label+' must be true or false');}else {if(typeof value!=='string'||value.length>4000)throw new Error(f.label+' is invalid');if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new Error(f.label+' must be a valid date');if(f.type==='select'&&!f.options.includes(value))throw new Error(f.label+' is not an available choice');}output[f.name]=value;}
 return output;
}
export function openApp(spec,filename){
 spec=validateSpec(spec);mkdirSync(path.dirname(filename),{recursive:true});const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (entity TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(entity,id)); CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, result TEXT NOT NULL);');
 return {spec,close:()=>db.close(),request(operation){
 const {action,entity:entityName,id,data,requestId}=operation;if(action==='spec')return spec;const entity=spec.entities.find(e=>e.name===entityName);if(!entity)throw new Error('Unknown collection');
 if(action==='list'){const rows=db.prepare('SELECT id,data,created,updated FROM records WHERE entity=? ORDER BY created DESC LIMIT 1000').all(entity.name);return rows.map(r=>({...JSON.parse(r.data),id:r.id,createdAt:r.created,updatedAt:r.updated}));}
 if(!['create','update','delete','import'].includes(action)||typeof requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(requestId))throw new Error('A valid request ID is required');const prior=db.prepare('SELECT result FROM receipts WHERE id=?').get(requestId);if(prior)return JSON.parse(prior.result);
 const now=new Date().toISOString();let result;db.exec('BEGIN IMMEDIATE');try{
 if(action==='import'){if(!Array.isArray(data)||!data.length||data.length>200)throw new Error('Import between one and 200 records');const rows=data.map(row=>validateRecord(entity,row));const insert=db.prepare('INSERT INTO records VALUES(?,?,?,?,?)');for(const row of rows)insert.run(entity.name,randomUUID(),JSON.stringify(row),now,now);result={imported:rows.length};}
 else if(action==='create'){const record=validateRecord(entity,data);const recordId=randomUUID();db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(entity.name,recordId,JSON.stringify(record),now,now);result={...record,id:recordId,createdAt:now,updatedAt:now};}
 else {if(typeof id!=='string')throw new Error('A record ID is required');const previous=db.prepare('SELECT data,created FROM records WHERE entity=? AND id=?').get(entity.name,id);if(!previous)throw new Error('Record not found');if(action==='delete'){db.prepare('DELETE FROM records WHERE entity=? AND id=?').run(entity.name,id);result={deleted:true,id};}else {const record=validateRecord(entity,data);db.prepare('UPDATE records SET data=?,updated=? WHERE entity=? AND id=?').run(JSON.stringify(record),now,entity.name,id);result={...record,id,createdAt:previous.created,updatedAt:now};}}
 db.prepare('INSERT INTO receipts VALUES(?,?)').run(requestId,JSON.stringify(result));db.exec('COMMIT');return result;
 }catch(error){db.exec('ROLLBACK');throw error;}
 }};
}
