Come il progetto principale, ma il DB va impostato con la variabile DB_\<databaseID>=\<path to json>

Ad es:

\"env\": {
	\"DB_database1": \"/path/to/database1.json\",
	\"DB_database2": \"/path/to/database2.json\"
}

e il json di configurazione deve essere nella forma:

{
	\"DB_HOST\":\"localhost\",
 	\"DB_PORT\":1433,
  	\"DB_USERNAME\":\"\<user>\",
   	\"DB_PASSWORD\":\"\<pass>\",
    	\"DB_DATABASE\":\"\<dbname>\"
}

Chiave opzionale: \"READ_ONLY\": true — il tool `execute-write` viene rifiutato su quel database.

## Tool

- `query`: sola lettura. Prima dell'esecuzione il batch viene compilato con `SET SHOWPLAN_XML ON` (senza eseguirlo) e sono ammessi solo gli statement di tipo SELECT, SELECT WITHOUT QUERY, ASSIGN (DECLARE/SET di variabili), COND e COND WITH QUERY (IF/WHILE). Tutto il resto (DML, DDL, SELECT INTO, EXEC, transazioni, USE) è rifiutato. La query viene poi eseguita dentro una transazione sempre annullata.
- `execute-write`: modifiche (INSERT, UPDATE, DELETE, MERGE, DDL, EXEC), in autocommit. Rifiutato sui database con `READ_ONLY: true` e sui batch di sola lettura (che vanno eseguiti con `query`).

In Claude Code conviene mettere `execute-write` tra le regole `ask` (o `deny`):

	"permissions": { "ask": ["mcp__mssql__execute-write"] }
