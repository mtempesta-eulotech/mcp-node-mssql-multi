import mssql from 'mssql';

export async function connect(databaseID: string): Promise<mssql.ConnectionPool> {
	let conf = JSON.parse(process.env.DB_CONF+"");
	let db = conf[databaseID];
		
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
}

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

