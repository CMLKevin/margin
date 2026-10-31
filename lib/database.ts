import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {dataDirectory} from '../server/settings.mjs';
class Statement {
 database:DatabaseSync; sql:string; values:SQLInputValue[];
 constructor(database:DatabaseSync,sql:string,values:SQLInputValue[]=[]){this.database=database;this.sql=sql;this.values=values;}
 bind(...values:SQLInputValue[]){return new Statement(this.database,this.sql,values);}
 async all<T=Record<string,unknown>>(){return {results:this.database.prepare(this.sql).all(...this.values).map(row=>({...row})) as T[]};}
 async first<T=Record<string,unknown>>(){const row=this.database.prepare(this.sql).get(...this.values);return row?{...row} as T:null;}
 runSync(){const result=this.database.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
 async run(){return this.runSync();}
}
export class LocalDatabase {
 connection:DatabaseSync;
 constructor(file:string){this.connection=new DatabaseSync(file);this.connection.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');const version=this.connection.prepare('PRAGMA user_version').get()?.user_version as number;if(version<1)this.connection.exec(readFileSync(path.join(process.cwd(),'server/schema.sql'),'utf8'));if(file!==':memory:')chmodSync(file,0o600);}
 prepare(sql:string){return new Statement(this.connection,sql);}
 async batch(statements:Statement[]){this.connection.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.runSync());this.connection.exec('COMMIT');return results;}catch(e){this.connection.exec('ROLLBACK');throw e;}}
 close(){this.connection.close();}
}
const databases=new Map<string,LocalDatabase>();
export function getDatabase(){const dir=dataDirectory();mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'library.sqlite');if(!databases.has(file))databases.set(file,new LocalDatabase(file));return databases.get(file)!;}
export function closeDatabases(){for(const db of databases.values())db.close();databases.clear();}
