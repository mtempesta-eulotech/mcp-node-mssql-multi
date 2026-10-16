import mssql from 'mssql';
import fs from 'fs';

// Tipi di statement (StatementType dello showplan) ammessi dal tool "query".
// SELECT / SELECT WITHOUT QUERY: letture; ASSIGN: DECLARE/SET di variabili; COND / COND WITH QUERY: IF/WHILE.
// Tutto il resto (DML, DDL, SELECT INTO, EXEC, transazioni, USE, cursori, ...) viene rifiutato.
const READ_ONLY_STATEMENT_TYPES = new Set(["SELECT", "SELECT WITHOUT QUERY", "ASSIGN", "COND", "COND WITH QUERY"]);

function readDbFile(databaseID: string): any {
	if(!process.env['DB_' + databaseID]) throw new RangeError("DatabaseID non trovato [" + databaseID + "]");

	try {
		return JSON.parse(fs.readFileSync(process.env['DB_' + databaseID] + "", 'utf-8'));
	} catch (err) {
		console.error("DatabaseID non trovato [" + databaseID + "]");
		throw err;
	}
}

function buildConfig(db: any): mssql.config {
	return {
		server: db.DB_HOST ?? '',
		port: Number(db.DB_PORT ?? 1433),
		user: db.DB_USERNAME,
		password: db.DB_PASSWORD,
		database: db.DB_DATABASE,
		connectionTimeout: Number(process.env.CONNECTION_TIMEOUT ?? 600000),
		requestTimeout: Number(process.env.REQUEST_TIMEOUT ?? 300000),
		options: {
			encrypt: process.env.DB_ENCRYPT === 'true',
			enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
			trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
			trustedConnection: process.env.TRUSTED_CONNECTION === 'true'
		}
	};
}

// true se il json di configurazione del database contiene "READ_ONLY": true
export function isReadOnly(databaseID: string): boolean {
	return readDbFile(databaseID).READ_ONLY === true;
}

// Pool dedicato per ogni chiamata (il chiamante lo chiude).
// mssql.connect() usa invece un pool globale unico: con chiamate concorrenti su database diversi
// può restituire il pool già aperto su un altro database.
export async function connect(databaseID: string): Promise<mssql.ConnectionPool> {
	// oldcode: return mssql.connect(buildConfig(readDbFile(databaseID)));
	return new mssql.ConnectionPool(buildConfig(readDbFile(databaseID))).connect();
}

/* oldcode: sostituito da readDbFile() + buildConfig() + connect() qui sopra
export async function connect(databaseID: string): Promise<mssql.ConnectionPool> {
	if(!process.env['DB_' + databaseID]) throw new RangeError("DatabaseID non trovato [" + databaseID + "]");

	try{
		let db = JSON.parse(fs.readFileSync(process.env['DB_' + databaseID] + "", 'utf-8'));

		//let conf = JSON.parse(process.env.DB_CONF+"");
		//let db = conf[databaseID];

		return mssql.connect({
			server: db.DB_HOST ?? '',
			port: Number(db.DB_PORT ?? 1433),
			user: db.DB_USERNAME,
			password: db.DB_PASSWORD,
			database: db.DB_DATABASE,
			connectionTimeout: Number(process.env.CONNECTION_TIMEOUT ?? 600000),
			requestTimeout: Number(process.env.REQUEST_TIMEOUT ?? 300000),
			options: {
				encrypt: process.env.DB_ENCRYPT === 'true',
				enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
				trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
				trustedConnection: process.env.TRUSTED_CONNECTION === 'true'
			}
		});
	} catch (err) {
		console.error("DatabaseID non trovato [" + databaseID + "]");
		throw err;
	}
}
*/

export async function usingConnection<T>(databaseID: string, callback: (connection: mssql.ConnectionPool) => Promise<T>): Promise<T> {
	const connection = await connect(databaseID);

	try {
		return await callback(connection);
	} catch (err) {
		throw err;
	} finally {
		await connection.close();
	}
}

export async function usingTransaction<T>(databaseID: string, callback: (transaction: mssql.Request) => Promise<T>): Promise<T> {
	return usingConnection(databaseID, async (connection) => {
		const transaction = new mssql.Transaction(connection);

		try {
			await transaction.begin();
			const returnValue = await callback(transaction.request());
			await transaction.commit();
			return returnValue;
		} catch (err) {
			await transaction.rollback();
			throw err;
		}
	});
}

export async function startTransaction(databaseID: string): Promise<mssql.Transaction> {
	return usingConnection(databaseID, async (connection) => {
		const transaction = new mssql.Transaction(connection);
		await transaction.begin();
		return transaction;
	});
}

export async function query(databaseID: string, query: string, interpolations: any = null): Promise<mssql.IRecordSet<any>> {
	let connection = null;
	try {
		connection = await connect(databaseID);
		const request = connection.request();
		if (interpolations) {
			Object.entries(interpolations).forEach(([key, value]) => request.input(key, value));
		}
		const { recordset } = await request.query(query);
		return recordset;
	} finally {
		await connection?.close();
	}
}

function hasShowPlan(result: mssql.IResult<any>): boolean {
	return JSON.stringify(result.recordsets ?? []).includes('ShowPlanXML');
}

// Compila il batch con SET SHOWPLAN_XML ON (nessuna esecuzione) e restituisce gli StatementType di ogni statement.
// Va chiamata dentro una transazione: la transazione tiene fissa la connessione fisica, quindi lo showplan
// resta attivo sulla stessa sessione su cui viene inviato il batch.
async function classifyStatements(transaction: mssql.Transaction, query: string): Promise<string[]> {
	let classified = false;
	await new mssql.Request(transaction).batch('SET SHOWPLAN_XML ON');
	try {
		// verifica che lo showplan sia davvero attivo prima di inviare il batch dell'utente
		const probe = await new mssql.Request(transaction).batch('SELECT 1');
		if (!hasShowPlan(probe)) throw new Error("SHOWPLAN_XML non attivo: query non eseguita");

		const result = await new mssql.Request(transaction).batch(query);
		if (!hasShowPlan(result)) throw new Error("Piano di esecuzione non ottenuto: query non eseguita");

		const xml = (result.recordsets as any[]).flat().map((row: any) => String(Object.values(row)[0])).join('\n');
		const types = [...xml.matchAll(/<Stmt\w+[^>]*?StatementType="([^"]+)"/g)].map(m => m[1]);
		classified = true;
		return types;
	} finally {
		try {
			await new mssql.Request(transaction).batch('SET SHOWPLAN_XML OFF');
		} catch (err) {
			// se la classificazione è riuscita ma lo showplan non si disattiva, la query non deve proseguire
			if (classified) throw err;
		}
	}
}

// Esegue una query in sola lettura:
// 1. classifica gli statement con lo showplan e rifiuta tutto ciò che non è in READ_ONLY_STATEMENT_TYPES;
// 2. esegue la query dentro una transazione che viene sempre annullata (secondo livello di protezione).
export async function readOnlyQuery(databaseID: string, query: string): Promise<mssql.IRecordSet<any>> {
	const pool = new mssql.ConnectionPool({ ...buildConfig(readDbFile(databaseID)), pool: { max: 1, min: 0 } });
	await pool.connect();
	const transaction = new mssql.Transaction(pool);
	try {
		await transaction.begin();

		const types = await classifyStatements(transaction, query);
		const forbidden = [...new Set(types.filter(t => !READ_ONLY_STATEMENT_TYPES.has(t)))];
		if (!types.length) throw new Error("Query rifiutata: nessuno statement riconosciuto");
		if (forbidden.length) throw new Error(`Query rifiutata: il tool "query" accetta solo letture. Statement non ammessi: ${forbidden.join(', ')}. Per le modifiche usare il tool "execute".`);

		const { recordset } = await new mssql.Request(transaction).query(query);
		return recordset;
	} finally {
		try {
			await transaction.rollback();
		} catch {
			// transazione mai iniziata o già annullata dal server
		}
		await pool.close();
	}
}

// Esegue uno statement di modifica (autocommit). Rifiutato se il database è configurato READ_ONLY.
export async function execute(databaseID: string, query: string): Promise<{ recordset: mssql.IRecordSet<any>, rowsAffected: number[] }> {
	if (isReadOnly(databaseID)) throw new Error(`Database [${databaseID}] configurato in sola lettura (READ_ONLY): modifica non consentita`);

	let connection = null;
	try {
		connection = await connect(databaseID);
		const { recordset, rowsAffected } = await connection.request().query(query);
		return { recordset, rowsAffected };
	} finally {
		await connection?.close();
	}
}

