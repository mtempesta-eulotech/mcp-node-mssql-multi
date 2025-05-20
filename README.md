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
