import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {createHash,randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import path from 'node:path';
import {normalizeProjectDesign} from './project-design.mjs';

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
  ALTER TABLE user_appearance_next RENAME TO user_appearance;`,
  `ALTER TABLE v3_tasks ADD COLUMN estimate_hours REAL CHECK(estimate_hours IS NULL OR estimate_hours BETWEEN 0 AND 1000);
  ALTER TABLE v3_tasks ADD COLUMN due_date TEXT;
  ALTER TABLE v3_tasks ADD COLUMN archived_at TEXT;
  CREATE TABLE v3_task_dependencies (
    task_id TEXT NOT NULL REFERENCES v3_tasks(id) ON DELETE CASCADE,
    depends_on_id TEXT NOT NULL REFERENCES v3_tasks(id) ON DELETE CASCADE,
    PRIMARY KEY(task_id,depends_on_id),
    CHECK(task_id<>depends_on_id)
  );
  CREATE INDEX v3_task_dependencies_parent ON v3_task_dependencies(depends_on_id);
  CREATE TABLE v3_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES v3_tasks(id) ON DELETE CASCADE,
    event TEXT NOT NULL CHECK(event IN ('created','updated','dependencies','archived','restored')),
    detail TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX v3_task_events_task ON v3_task_events(task_id,at);`,
  `CREATE TABLE v3_builds (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES v3_projects(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running','passed','failed','interrupted')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    spec_json TEXT,
    report_json TEXT,
    folder TEXT,
    error TEXT
  );
  CREATE INDEX v3_builds_project ON v3_builds(project_id,started_at DESC);`,
  `CREATE TABLE v3_publications (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE REFERENCES v3_projects(id) ON DELETE CASCADE,
    build_id TEXT NOT NULL REFERENCES v3_builds(id),
    repo_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('publishing','public','failed','interrupted')),
    repo_url TEXT,
    commit_sha TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  );`,
  `ALTER TABLE v3_projects ADD COLUMN design_json TEXT;`
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
  db.prepare("UPDATE v3_builds SET status='interrupted',finished_at=?,error='Host restarted during build; inspect staging before retrying' WHERE status='running'").run(new Date().toISOString());
  db.prepare("UPDATE v3_publications SET status='interrupted',finished_at=?,error='Host restarted during publication; inspect GitHub before retrying' WHERE status='publishing'").run(new Date().toISOString());
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
  const projectById=db.prepare('SELECT id,user_id AS userId,title,problem,goal,success_metric AS successMetric,scope,source_url AS sourceUrl,status,design_json AS designJson,created_at AS createdAt,updated_at AS updatedAt FROM v3_projects WHERE id=? AND user_id=?');
  const projectsByUser=db.prepare('SELECT id,user_id AS userId,title,problem,goal,success_metric AS successMetric,scope,source_url AS sourceUrl,status,design_json AS designJson,created_at AS createdAt,updated_at AS updatedAt FROM v3_projects WHERE user_id=? ORDER BY updated_at DESC');
  const updateProject=db.prepare("UPDATE v3_projects SET title=?,problem=?,goal=?,success_metric=?,scope=?,updated_at=? WHERE id=? AND user_id=? AND status='proposal'");
  const approveProject=db.prepare("UPDATE v3_projects SET status='approved',design_json=?,updated_at=? WHERE id=? AND user_id=? AND status='proposal'");
  const insertTask=db.prepare("INSERT INTO v3_tasks (id,project_id,title,description,acceptance,evidence,status,priority,estimate_hours,due_date,created_at,updated_at) VALUES (?,?,?,?,?,NULL,'todo',?,?,?,?,?)");
  const taskById=db.prepare('SELECT id,project_id AS projectId,title,description,acceptance,evidence,status,priority,estimate_hours AS estimateHours,due_date AS dueDate,archived_at AS archivedAt,created_at AS createdAt,updated_at AS updatedAt FROM v3_tasks WHERE id=? AND project_id=?');
  const tasksByProject=db.prepare('SELECT id,project_id AS projectId,title,description,acceptance,evidence,status,priority,estimate_hours AS estimateHours,due_date AS dueDate,archived_at AS archivedAt,created_at AS createdAt,updated_at AS updatedAt FROM v3_tasks WHERE project_id=? ORDER BY created_at');
  const updateTask=db.prepare('UPDATE v3_tasks SET title=?,description=?,acceptance=?,evidence=?,status=?,priority=?,estimate_hours=?,due_date=?,updated_at=? WHERE id=? AND project_id=?');
  const changeArchive=db.prepare('UPDATE v3_tasks SET archived_at=?,updated_at=? WHERE id=? AND project_id=?');
  const deleteTask=db.prepare('DELETE FROM v3_tasks WHERE id=? AND project_id=?');
  const dependenciesByTask=db.prepare('SELECT depends_on_id AS id FROM v3_task_dependencies WHERE task_id=? ORDER BY depends_on_id');
  const allDependencies=db.prepare('SELECT d.task_id AS taskId,d.depends_on_id AS dependsOnId FROM v3_task_dependencies d JOIN v3_tasks t ON t.id=d.task_id WHERE t.project_id=?');
  const dependentsByTask=db.prepare('SELECT t.id,t.status FROM v3_task_dependencies d JOIN v3_tasks t ON t.id=d.task_id WHERE d.depends_on_id=? AND t.project_id=?');
  const clearDependencies=db.prepare('DELETE FROM v3_task_dependencies WHERE task_id=?');
  const addDependency=db.prepare('INSERT INTO v3_task_dependencies (task_id,depends_on_id) VALUES (?,?)');
  const appendTaskEvent=db.prepare('INSERT INTO v3_task_events (id,task_id,event,detail,at) VALUES (?,?,?,?,?)');
  const taskEvents=db.prepare('SELECT event,detail,at FROM v3_task_events WHERE task_id=? ORDER BY at,id');
  const insertBuild=db.prepare("INSERT INTO v3_builds (id,project_id,model,status,started_at) VALUES (?,?,?,'running',?)");
  const finishBuild=db.prepare('UPDATE v3_builds SET status=?,finished_at=?,spec_json=?,report_json=?,folder=?,error=? WHERE id=? AND status=\'running\'');
  const buildsByProject=db.prepare('SELECT id,project_id AS projectId,model,status,started_at AS startedAt,finished_at AS finishedAt,spec_json AS specJson,report_json AS reportJson,folder,error FROM v3_builds WHERE project_id=? ORDER BY started_at DESC LIMIT 30');
  const insertPublication=db.prepare("INSERT INTO v3_publications (id,project_id,build_id,repo_name,status,started_at) VALUES (?,?,?,?,'publishing',?)");
  const finishPublication=db.prepare("UPDATE v3_publications SET status=?,repo_url=?,commit_sha=?,error=?,finished_at=? WHERE id=? AND status='publishing'");
  const publicationByProject=db.prepare('SELECT id,project_id AS projectId,build_id AS buildId,repo_name AS repoName,status,repo_url AS repoUrl,commit_sha AS commitSha,error,started_at AS startedAt,finished_at AS finishedAt FROM v3_publications WHERE project_id=?');
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
    createProject(userId,input){const now=new Date().toISOString(),id=randomUUID();insertProject.run(id,userId,input.title,input.problem,input.goal,input.successMetric,input.scope,input.sourceUrl||null,now,now);return this.project(userId,id);},
    project(userId,id){const row=projectById.get(id,userId);return row?{...row,design:row.designJson?JSON.parse(row.designJson):null}:null;},
    projects(userId){return projectsByUser.all(userId).map(row=>({...row,design:row.designJson?JSON.parse(row.designJson):null}));},
    editProject(userId,id,input){if(!updateProject.run(input.title,input.problem,input.goal,input.successMetric,input.scope,new Date().toISOString(),id,userId).changes)throw new Error('Draft proposal unavailable');return this.project(userId,id);},
    approveProject(userId,id,design){design=normalizeProjectDesign(design);if(!approveProject.run(JSON.stringify(design),new Date().toISOString(),id,userId).changes)throw new Error('Draft proposal unavailable');return this.project(userId,id);},
    createTask(userId,projectId,input){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');const now=new Date().toISOString(),id=randomUUID();insertTask.run(id,projectId,input.title,input.description,input.acceptance,input.priority,input.estimateHours??null,input.dueDate??null,now,now);appendTaskEvent.run(randomUUID(),id,'created',input.title,now);return {...taskById.get(id,projectId),dependencies:[]};},
    tasks(userId,projectId){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');return tasksByProject.all(projectId).map(item=>({...item,dependencies:dependenciesByTask.all(item.id).map(row=>row.id)}));},
    taskHistory(userId,projectId,id){if(!projectById.get(projectId,userId)||!taskById.get(id,projectId))throw new Error('Task unavailable');return taskEvents.all(id);},
    setTaskDependencies(userId,projectId,id,ids){
      if(!projectById.get(projectId,userId)||!taskById.get(id,projectId))throw new Error('Task unavailable');
      if(!Array.isArray(ids)||ids.length>30||new Set(ids).size!==ids.length||ids.some(value=>!/^[a-f0-9-]{36}$/i.test(value)||value===id||!taskById.get(value,projectId)))throw new Error('Dependencies must be distinct tasks in this project');
      if(taskById.get(id,projectId).status==='done'&&ids.some(value=>taskById.get(value,projectId).status!=='done'))throw new Error('A completed task cannot have unfinished blockers');
      const edges=allDependencies.all(projectId).filter(edge=>edge.taskId!==id);
      edges.push(...ids.map(dependsOnId=>({taskId:id,dependsOnId})));
      const parents=new Map();for(const edge of edges)parents.set(edge.taskId,[...(parents.get(edge.taskId)||[]),edge.dependsOnId]);
      const visited=new Set(),active=new Set();const visit=node=>{if(active.has(node))throw new Error('Task dependencies cannot form a cycle');if(visited.has(node))return;active.add(node);for(const parent of parents.get(node)||[])visit(parent);active.delete(node);visited.add(node);};for(const node of parents.keys())visit(node);
      db.exec('BEGIN IMMEDIATE');try{clearDependencies.run(id);for(const parent of ids)addDependency.run(id,parent);appendTaskEvent.run(randomUUID(),id,'dependencies',JSON.stringify(ids),new Date().toISOString());db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
      return {...taskById.get(id,projectId),dependencies:ids};
    },
    updateTask(userId,projectId,id,input){if(!projectById.get(projectId,userId)||!taskById.get(id,projectId))throw new Error('Task unavailable');if(input.status==='done'){for(const row of dependenciesByTask.all(id)){if(taskById.get(row.id,projectId)?.status!=='done')throw new Error('Complete blocking tasks before marking this task done');}}else if(dependentsByTask.all(id,projectId).some(item=>item.status==='done'))throw new Error('A completed dependent task requires this blocker to stay complete');const now=new Date().toISOString();updateTask.run(input.title,input.description,input.acceptance,input.evidence||null,input.status,input.priority,input.estimateHours??null,input.dueDate??null,now,id,projectId);appendTaskEvent.run(randomUUID(),id,'updated',JSON.stringify({status:input.status,title:input.title}),now);return {...taskById.get(id,projectId),dependencies:dependenciesByTask.all(id).map(row=>row.id)};},
    archiveTask(userId,projectId,id,archive){if(!projectById.get(projectId,userId)||!taskById.get(id,projectId))throw new Error('Task unavailable');const now=new Date().toISOString();changeArchive.run(archive?now:null,now,id,projectId);appendTaskEvent.run(randomUUID(),id,archive?'archived':'restored','User action',now);return {...taskById.get(id,projectId),dependencies:dependenciesByTask.all(id).map(row=>row.id)};},
    deleteTask(userId,projectId,id){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');if(dependentsByTask.all(id,projectId).length)throw new Error('Remove dependent links before deleting this task');return Number(deleteTask.run(id,projectId).changes);},
    startBuild(userId,projectId,id,model){if(!projectById.get(projectId,userId)||projectById.get(projectId,userId).status!=='approved')throw new Error('Approved project unavailable');if(!/^[a-f0-9-]{36}$/i.test(id)||typeof model!=='string'||model.length>100)throw new Error('Invalid build');insertBuild.run(id,projectId,model,new Date().toISOString());},
    finishBuild(id,result){if(!['passed','failed'].includes(result.status))throw new Error('Invalid build status');finishBuild.run(result.status,new Date().toISOString(),result.spec?JSON.stringify(result.spec):null,result.report?JSON.stringify(result.report):null,result.folder||null,result.error?String(result.error).slice(0,1000):null,id);},
    builds(userId,projectId){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');return buildsByProject.all(projectId).map(item=>({id:item.id,projectId:item.projectId,model:item.model,status:item.status,startedAt:item.startedAt,finishedAt:item.finishedAt,spec:item.specJson?JSON.parse(item.specJson):null,report:item.reportJson?JSON.parse(item.reportJson):null,folder:item.folder,error:item.error}));},
    publication(userId,projectId){if(!projectById.get(projectId,userId))throw new Error('Project unavailable');return publicationByProject.get(projectId)||null;},
    startPublication(userId,projectId,buildId,id,repoName){if(!projectById.get(projectId,userId)||!buildsByProject.all(projectId).some(item=>item.id===buildId&&item.status==='passed'))throw new Error('Passed project build unavailable');if(!/^[a-f0-9-]{36}$/i.test(id)||typeof repoName!=='string'||repoName.length>100)throw new Error('Invalid publication');insertPublication.run(id,projectId,buildId,repoName,new Date().toISOString());},
    finishPublication(id,result){if(!['public','failed'].includes(result.status))throw new Error('Invalid publication status');finishPublication.run(result.status,result.repoUrl||null,result.commitSha||null,result.error?String(result.error).slice(0,1000):null,new Date().toISOString(),id);},
    putCache(key,provider,payload,ttlMs,etag=null){if(!/^[a-z0-9:_/-]{1,180}$/i.test(key)||!/^[a-z0-9_-]{1,40}$/i.test(provider)||!Number.isFinite(ttlMs)||ttlMs<1000||ttlMs>604800000)throw new Error('Invalid cache entry');const json=JSON.stringify(payload);if(json.length>1000000)throw new Error('Cache entry too large');const now=Date.now();putCache.run(key,provider,json,new Date(now).toISOString(),new Date(now+ttlMs).toISOString(),etag);},
    getCache(key,{allowStale=false}={}){const row=getCache.get(key);if(!row||(!allowStale&&Date.parse(row.expiresAt)<=Date.now()))return null;return {...row,payload:JSON.parse(row.payload),stale:Date.parse(row.expiresAt)<=Date.now()};},
    close(){db.close();}
  };
}
