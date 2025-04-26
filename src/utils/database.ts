import mssql from 'mssql';

export async function connect(): Promise<mssql.ConnectionPool> {
	return mssql.connect({
		server: process.env.DB_HOST ?? '',
		port: Number(process.env.DB_PORT ?? 1433),
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_DATABASE,
		connectionTimeout: Number(process.env.CONNECTION_TIMEOUT) ?? 600000,
		requestTimeout: Number(process.env.REQUEST_TIMEOUT) ?? 300000,
		options: {
			encrypt: process.env.DB_ENCRYPT === 'true',
			enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
			trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
			trustedConnection: process.env.TRUSTED_CONNECTION === 'true'
		}
	});
}

export async function usingConnection<T>(callback: (connection: mssql.ConnectionPool) => Promise<T>): Promise<T> {
	const connection = await connect();

	try {
		return await callback(connection);
	} catch (err) {
		throw err;
	} finally {
		await connection.close();
	}
}

export async function usingTransaction<T>(callback: (transaction: mssql.Request) => Promise<T>): Promise<T> {
	return usingConnection(async (connection) => {
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

export async function startTransaction(): Promise<mssql.Transaction> {
	return usingConnection(async (connection) => {
		const transaction = new mssql.Transaction(connection);
		await transaction.begin();
		return transaction;
	});
}

export async function query(query: string, interpolations: any[] = []): Promise<mssql.IRecordSet<any>> {
	let connection = null;
	try {
		connection = await connect();
		const request = connection.request();
		interpolations.forEach((value, index) => request.input(`param${index}`, value));
		const { recordset } = await request.query(query);
		return recordset;
	} finally {
		await connection?.close();
	}
}

