import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {createHash,randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
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
  CREATE INDEX IF NOT EXISTS pending_commands_queue ON pending_commands(status,queued_at);`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','member')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profile_json TEXT NOT NULL,
    consent_at TEXT,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS discovery_feedback (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    canonical_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('saved','dismissed')),
    reason TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id,canonical_url)
  );
  CREATE INDEX IF NOT EXISTS discovery_feedback_user ON discovery_feedback(user_id,status);`,
  `CREATE TABLE IF NOT EXISTS user_appearance (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL CHECK(theme IN ('nebula','sunset')),
    reduced_motion INTEGER NOT NULL CHECK(reduced_motion IN (0,1)),
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS v3_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    problem TEXT NOT NULL,
    goal TEXT NOT NULL,
    success_metric TEXT NOT NULL,
    scope TEXT NOT NULL,
    source_url TEXT,
    status TEXT NOT NULL CHECK(status IN ('proposal','approved')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS v3_projects_owner ON v3_projects(user_id,updated_at DESC);
  CREATE TABLE IF NOT EXISTS v3_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES v3_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance TEXT NOT NULL,
    evidence TEXT,
    status TEXT NOT NULL CHECK(status IN ('todo','in_progress','review','blocked','done')),
    priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS v3_tasks_project ON v3_tasks(project_id,created_at);`
  ,`CREATE TABLE user_appearance_next (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL CHECK(theme='eclipse'),
    reduced_motion INTEGER NOT NULL CHECK(reduced_motion IN (0,1)),
    updated_at TEXT NOT NULL
  );
  INSERT INTO user_appearance_next (user_id,theme,reduced_motion,updated_at)
    SELECT user_id,'eclipse',reduced_motion,updated_at FROM user_appearance;
  DROP TABLE user_appearance;
  ALTER TABLE user_appearance_next RENAME TO user_appearance;`
];

export function openV3Store(filename){
  mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  if(process.platform!=='win32'){chmodSync(path.dirname(filename),0o700);chmodSync(filename,0o600);}
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
  const userCount=db.prepare('SELECT COUNT(*) AS count FROM users');
  const insertUser=db.prepare('INSERT INTO users (id,email,password_salt,password_hash,role,created_at) VALUES (?,?,?,?,?,?)');
  const userByEmail=db.prepare('SELECT id,email,password_salt AS salt,password_hash AS hash,role FROM users WHERE email=?');
  const insertSession=db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)');
  const sessionByHash=db.prepare('SELECT u.id,u.email,u.role,s.expires_at AS expiresAt FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?');
  const deleteSession=db.prepare('DELETE FROM sessions WHERE token_hash=?');
  const upsertProfile=db.prepare('INSERT INTO profiles (user_id,profile_json,consent_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile_json=excluded.profile_json,consent_at=excluded.consent_at,updated_at=excluded.updated_at');
  const profileByUser=db.prepare('SELECT profile_json AS json,consent_at AS consentAt,updated_at AS updatedAt FROM profiles WHERE user_id=?');
  const deleteProfile=db.prepare('DELETE FROM profiles WHERE user_id=?');
  const upsertFeedback=db.prepare('INSERT INTO discovery_feedback (user_id,canonical_url,status,reason,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,canonical_url) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at');
  const feedbackByUser=db.prepare('SELECT canonical_url AS canonicalUrl,status,reason,updated_at AS updatedAt FROM discovery_feedback WHERE user_id=? ORDER BY updated_at DESC');
  const deleteFeedback=db.prepare('DELETE FROM discovery_feedback WHERE user_id=? AND canonical_url=?');
  const appearanceByUser=db.prepare('SELECT theme,reduced_motion AS reducedMotion,updated_at AS updatedAt FROM user_appearance WHERE user_id=?');
  const upsertAppearance=db.prepare('INSERT INTO user_appearance (user_id,theme,reduced_motion,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET theme=excluded.theme,reduced_motion=excluded.reduced_motion,updated_at=excluded.updated_at');
  const insertProject=db.prepare("INSERT INTO v3_projects (id,user_id,title,problem,goal,success_metric,scope,source_url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'proposal',?,?)");
  const projectById=db.prepare('SELECT id,user_id AS userId,title,problem,goal,success_metric AS successMetric,scope,source_url AS sourceUrl,status,created_at AS createdAt,updated_at AS updatedAt FROM v3_projects WHERE id=? AND user_id=?');
  const projectsByUser=db.prepare('SELECT id,user_id AS userId,title,problem,goal,success_metric AS successMetric,scope,source_url AS sourceUrl,status,created_at AS createdAt,updated_at AS updatedAt FROM v3_projects WHERE user_id=? ORDER BY updated_at DESC');
  const updateProject=db.prepare("UPDATE v3_projects SET title=?,problem=?,goal=?,success_metric=?,scope=?,updated_at=? WHERE id=? AND user_id=? AND status='proposal'");
  const approveProject=db.prepare("UPDATE v3_projects SET status='approved',updated_at=? WHERE id=? AND user_id=? AND status='proposal'");
  const insertTask=db.prepare("INSERT INTO v3_tasks (id,project_id,title,description,acceptance,evidence,status,priority,created_at,updated_at) VALUES (?,?,?,?,?,NULL,'todo',?,?,?)");
  const taskById=db.prepare('SELECT id,project_id AS projectId,title,description,acceptance,evidence,status,priority,created_at AS createdAt,updated_at AS updatedAt FROM v3_tasks WHERE id=? AND project_id=?');
  const tasksByProject=db.prepare('SELECT id,project_id AS projectId,title,description,acceptance,evidence,status,priority,created_at AS createdAt,updated_at AS updatedAt FROM v3_tasks WHERE project_id=? ORDER BY created_at');
  const updateTask=db.prepare('UPDATE v3_tasks SET title=?,description=?,acceptance=?,evidence=?,status=?,priority=?,updated_at=? WHERE id=? AND project_id=?');
  const deleteTask=db.prepare('DELETE FROM v3_tasks WHERE id=? AND project_id=?');
  const tokenHash=token=>createHash('sha256').update(token).digest('hex');
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
    userCount(){return Number(userCount.get().count);},
    createUser(email,password,role='member'){
      email=String(email||'').trim().toLowerCase();
      if(!/^[^@\s]{1,64}@[^@\s]{2,180}$/.test(email)||typeof password!=='string'||password.length<12||password.length>200||!['owner','member'].includes(role))throw new Error('Use a valid email and a password of 12 to 200 characters');
      if(role==='owner'&&Number(userCount.get().count)>0)throw new Error('Owner account already exists');
      const salt=randomBytes(24).toString('hex'),hash=scryptSync(password,salt,64).toString('hex'),id=randomUUID();
      insertUser.run(id,email,salt,hash,role,new Date().toISOString());return {id,email,role};
    },
    verifyUser(email,password){
      const user=userByEmail.get(String(email||'').trim().toLowerCase());
      const derived=scryptSync(String(password||''),user?.salt||'missing-account-salt',64);
      const expected=Buffer.from(user?.hash||'00'.repeat(64),'hex');
      return user&&timingSafeEqual(derived,expected)?{id:user.id,email:user.email,role:user.role}:null;
    },
    createSession(userId){const token=randomBytes(32).toString('hex'),now=Date.now();insertSession.run(tokenHash(token),userId,new Date(now+12*3600000).toISOString(),new Date(now).toISOString());return token;},
    authenticate(token){if(!/^[a-f0-9]{64}$/.test(String(token||'')))return null;const user=sessionByHash.get(tokenHash(token));return user&&Date.parse(user.expiresAt)>Date.now()?{id:user.id,email:user.email,role:user.role}:null;},
    destroySession(token){if(/^[a-f0-9]{64}$/.test(String(token||'')))deleteSession.run(tokenHash(token));},
    saveProfile(userId,profile,consent){const json=JSON.stringify(profile);if(json.length>20000)throw new Error('Profile too large');const now=new Date().toISOString();upsertProfile.run(userId,json,consent?now:null,now);return {profile,consentAt:consent?now:null,updatedAt:now};},
    loadProfile(userId){const row=profileByUser.get(userId);return row?{profile:JSON.parse(row.json),consentAt:row.consentAt,updatedAt:row.updatedAt}:null;},
    deleteProfile(userId){return Number(deleteProfile.run(userId).changes);},
    saveFeedback(userId,canonicalUrl,status,reason=''){
      if(typeof canonicalUrl!=='string'||canonicalUrl.length>600||!/^https:\/\/(openalex\.org|doi\.org)\//.test(canonicalUrl)||!['saved','dismissed'].includes(status)||typeof reason!=='string'||reason.length>160)throw new Error('Invalid discovery feedback');
      upsertFeedback.run(userId,canonicalUrl,status,reason.trim(),new Date().toISOString());return {canonicalUrl,status,reason:reason.trim()};
    },
    listFeedback(userId){return feedbackByUser.all(userId);},
    deleteFeedback(userId,canonicalUrl){return Number(deleteFeedback.run(userId,canonicalUrl).changes);},
    appearance(userId){const item=appearanceByUser.get(userId);return item?{theme:item.theme,reducedMotion:Boolean(item.reducedMotion),updatedAt:item.updatedAt}:{theme:'eclipse',reducedMotion:false,updatedAt:null};},
    saveAppearance(userId,theme,reducedMotion){if(theme!=='eclipse'||typeof reducedMotion!=='boolean')throw new Error('Invalid appearance settings');upsertAppearance.run(userId,theme,Number(reducedMotion),new Date().toISOString());return this.appearance(userId);},
    createProject(userId,input){const now=new Date().toISOString(),id=randomUUID();insertProject.run(id,userId,input.title,input.problem,input.goal,input.successMetric,input.scope,input.sourceUrl||null,now,now);return projectById.get(id,userId);},
    project(userId,id){return projectById.get(id,userId)||null;},
    projects(userId){return projectsByUser.all(userId);},
    editProject(userId,id,input){if(!updateProject.run(input.title,input.problem,input.goal,input.successMetric,input.scope,new Date().toISOString(),id,userId).changes)throw new Error('Draft proposal unavailable');return projectById.get(id,userId);},
    approveProject(userId,id){if(!approveProject.run(new Date().toISOString(),id,userId).changes)throw new Error('Draft proposal unavailable');return projectById.get(id,userId);},
    createTask(userId,projectId,input){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');const now=new Date().toISOString(),id=randomUUID();insertTask.run(id,projectId,input.title,input.description,input.acceptance,input.priority,now,now);return taskById.get(id,projectId);},
    tasks(userId,projectId){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');return tasksByProject.all(projectId);},
    updateTask(userId,projectId,id,input){if(!projectById.get(projectId,userId)||!taskById.get(id,projectId))throw new Error('Task unavailable');updateTask.run(input.title,input.description,input.acceptance,input.evidence||null,input.status,input.priority,new Date().toISOString(),id,projectId);return taskById.get(id,projectId);},
    deleteTask(userId,projectId,id){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');return Number(deleteTask.run(id,projectId).changes);},
    putCache(key,provider,payload,ttlMs,etag=null){if(!/^[a-z0-9:_/-]{1,180}$/i.test(key)||!/^[a-z0-9_-]{1,40}$/i.test(provider)||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>604800000)throw new Error('Invalid cache entry');const json=JSON.stringify(payload);if(json.length>1000000)throw new Error('Cache entry too large');const now=Date.now();putCache.run(key,provider,json,new Date(now).toISOString(),new Date(now+ttlMs).toISOString(),etag);},
    getCache(key,{allowStale=false}={}){const row=getCache.get(key);if(!row||(!allowStale&&Date.parse(row.expiresAt)<=Date.now()))return null;return {...row,payload:JSON.parse(row.payload),stale:Date.parse(row.expiresAt)<=Date.now()};},
    close(){db.close();}
  };
}
