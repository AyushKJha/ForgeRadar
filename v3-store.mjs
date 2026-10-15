import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const migrations=[
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 40),
    status TEXT NOT NULL CHECK(status IN ('running','complete','blocked','cancelled','interrupted')),
    stage TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS jobs_started_at ON jobs(started_at DESC);
  CREATE TABLE IF NOT EXISTS source_cache (
    cache_key TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    payload TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    etag TEXT
  );
  CREATE INDEX IF NOT EXISTS source_cache_expires_at ON source_cache(expires_at);`,
  `CREATE TABLE IF NOT EXISTS pending_commands (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('prompt','discover','build','sync','daily')),
    input TEXT,
    command_id TEXT UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('queued','claimed','complete','blocked','cancelled','interrupted')),
    queued_at TEXT NOT NULL,
    claimed_at TEXT,
    finished_at TEXT,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS pending_commands_queue ON pending_commands(status,queued_at);`
];

export function openV3Store(filename){
  mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const current=db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get().version;
  if(current>migrations.length){db.close();throw new Error(`V3 database schema ${current} is newer than this application`);}
  for(let version=current+1;version<=migrations.length;version++){
    db.exec('BEGIN IMMEDIATE');
    try{db.exec(migrations[version-1]);db.prepare('INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)').run(version,new Date().toISOString());db.exec('COMMIT');}
    catch(error){db.exec('ROLLBACK');db.close();throw error;}
  }
  const interrupted=db.prepare("UPDATE jobs SET status='interrupted',finished_at=?,error='Worker restarted before this job finished' WHERE status='running'").run(new Date().toISOString()).changes;
  const interruptedCommands=db.prepare("UPDATE pending_commands SET status='interrupted',finished_at=?,error='Worker restarted during this command; review before retrying' WHERE status='claimed'").run(new Date().toISOString()).changes;
  const begin=db.prepare("INSERT INTO jobs (id,kind,status,stage,started_at) VALUES (?,?,'running',NULL,?)");
  const stage=db.prepare("UPDATE jobs SET stage=? WHERE id=? AND status='running'");
  const finish=db.prepare("UPDATE jobs SET status=?,stage=?,finished_at=?,error=? WHERE id=? AND status='running'");
  const counts=db.prepare('SELECT status,COUNT(*) AS count FROM jobs GROUP BY status');
  const recent=db.prepare('SELECT id,kind,status,stage,started_at AS startedAt,finished_at AS finishedAt,error FROM jobs ORDER BY started_at DESC LIMIT ?');
  const putCache=db.prepare(`INSERT INTO source_cache (cache_key,provider,payload,fetched_at,expires_at,etag) VALUES (?,?,?,?,?,?)
    ON CONFLICT(cache_key) DO UPDATE SET provider=excluded.provider,payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,etag=excluded.etag`);
  const getCache=db.prepare('SELECT provider,payload,fetched_at AS fetchedAt,expires_at AS expiresAt,etag FROM source_cache WHERE cache_key=?');
  const insertCommand=db.prepare("INSERT INTO pending_commands (id,kind,input,command_id,status,queued_at) VALUES (?,?,?,?,'queued',?)");
  const commandById=db.prepare('SELECT id,kind,input,command_id AS commandId,status FROM pending_commands WHERE id=?');
  const commandByReceipt=db.prepare('SELECT id,kind,input,command_id AS commandId,status FROM pending_commands WHERE command_id=?');
  const nextCommand=db.prepare("SELECT id,kind,input,command_id AS commandId,status FROM pending_commands WHERE status='queued' ORDER BY queued_at,rowid LIMIT 1");
  const claimCommand=db.prepare("UPDATE pending_commands SET status='claimed',claimed_at=? WHERE id=? AND status='queued'");
  const finishCommand=db.prepare("UPDATE pending_commands SET status=?,finished_at=?,error=? WHERE id=? AND status='claimed'");
  const pendingCount=db.prepare("SELECT COUNT(*) AS count FROM pending_commands WHERE status='queued'");
  return {
    schemaVersion:migrations.length,
    interruptedOnOpen:Number(interrupted)+Number(interruptedCommands),
    begin(id,kind){if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-z]{3,40}$/.test(kind))throw new Error('Invalid job identity');begin.run(id,kind,new Date().toISOString());},
    stage(id,name){stage.run(String(name).slice(0,80),id);},
    finish(id,status,name,error=null){if(!['complete','blocked','cancelled'].includes(status))throw new Error('Invalid final job status');finish.run(status,name||null,new Date().toISOString(),error?String(error).slice(0,500):null,id);},
    health(){return {schemaVersion:migrations.length,interruptedOnOpen:Number(interrupted)+Number(interruptedCommands),pending:Number(pendingCount.get().count),counts:Object.fromEntries(counts.all().map(row=>[row.status,row.count])),recent:recent.all(10)};},
    enqueue({id,kind,input=null,commandId=null}){if(!/^[a-f0-9-]{36}$/i.test(id)||!['prompt','discover','build','sync','daily'].includes(kind)||input!==null&&(typeof input!=='string'||input.length>8000)||commandId!==null&&!/^[-a-zA-Z0-9]{8,100}$/.test(commandId))throw new Error('Invalid queued command');if(commandId){const prior=commandByReceipt.get(commandId);if(prior)return prior;}insertCommand.run(id,kind,input,commandId,new Date().toISOString());return commandById.get(id);},
    claimNext(){db.exec('BEGIN IMMEDIATE');try{const command=nextCommand.get();if(command)claimCommand.run(new Date().toISOString(),command.id);db.exec('COMMIT');return command?{...command,status:'claimed'}:null;}catch(error){db.exec('ROLLBACK');throw error;}},
    finishCommand(id,status,error=null){if(!['complete','blocked','cancelled'].includes(status))throw new Error('Invalid command result');finishCommand.run(status,new Date().toISOString(),error?String(error).slice(0,500):null,id);},
    putCache(key,provider,payload,ttlMs,etag=null){if(!/^[a-z0-9:_/-]{1,180}$/i.test(key)||!/^[a-z0-9_-]{1,40}$/i.test(provider)||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>604800000)throw new Error('Invalid cache entry');const json=JSON.stringify(payload);if(json.length>1000000)throw new Error('Cache entry too large');const now=Date.now();putCache.run(key,provider,json,new Date(now).toISOString(),new Date(now+ttlMs).toISOString(),etag);},
    getCache(key,{allowStale=false}={}){const row=getCache.get(key);if(!row||(!allowStale&&Date.parse(row.expiresAt)<=Date.now()))return null;return {...row,payload:JSON.parse(row.payload),stale:Date.parse(row.expiresAt)<=Date.now()};},
    close(){db.close();}
  };
}
