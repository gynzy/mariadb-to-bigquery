let mysql = require('mysql');
let bigquery = require('@google-cloud/bigquery');
let esMap = require('event-stream').map;

let ndjson = require('ndjson');

module.exports = class MySQLtoBigQuery {

  constructor() {
    this.limit = process.env.QUERY_LIMIT || 5;

    // init MySQL
    this.connection = mysql.createConnection({
      host: process.env.RDS_HOST,
      user: process.env.RDS_USER,
      password: process.env.RDS_PASSWORD,
      database: process.env.RDS_DATABASE
    });

    this.connection.connect();

    // init BigQuery
    this.bq = bigquery({
      projectId: process.env.BQ_PROJECT_ID,
      keyFilename: 'google-keyfile.json'
    });

    this.dataset = this.bq.dataset(process.env.BQ_DATASET);
  }

  exec(table) {
    return this._syncTable(table);
  }

  _syncTable(tableName) {
    return new Promise((resolve, reject) => {
      this._createOrUpdateTable(tableName).then(fields => {
        return this._insertRecords(fields, tableName, this.dataset, this.limit);
      }).then(_ => {
        resolve();
      }).catch(reject);
    });
  }

  _createOrUpdateTable(tableName) {
    return new Promise((resolve, reject) => {

      this.connection.query(`DESC ${tableName};`, (error, rows, fields) => {
        if (error) return reject(error);

        const json = rows.map(row => Object({
          name: row.Field,
          type: this._convertToBqColumnType(row.Type)
        }));

        const options = {
          schema: {
            fields: json
          }
        };

        const table = this.dataset.table(tableName);
        table.exists().then((data) => {
          var exists = data[0];
          if (exists) {
            console.log(`Table ${tableName} exists in BigQuery, will use existing schema, beware of schema changes, not updating for now...`);
            //TODO update schema is needed
            resolve(json);
          } else {
            this.dataset.createTable(tableName, options, (error) => {
              if (error) return reject(error);
              // Give BQ some time before we start streaming data
              setTimeout(function () {
                resolve(json);
              }, 3000);
            });
          }
        });
      });
    });
  }

  _insertRecords(fields, tableName, dataset, limit) {
    const table = dataset.table(tableName);

    let writeStream = table.createWriteStream('json');
    let start = new Date().getTime();
    return new Promise((resolve, reject) => {
      let lastId = 0;
      var query = 'SELECT max(id) as maxId FROM [' + tableName + '] LIMIT 1';
      dataset.query(query).then((rows) => {
        // Handle results here.
        console.log(`Found existing max(id) for ${tableName}: `, rows);
        lastId = rows[0][0].maxId !== null ? rows[0][0].maxId : 0;
        console.log(`Selecting new rows for ${tableName} from ${lastId} with a limit of ${limit}.`);
        let query = this.connection.query(`SELECT * FROM ${tableName} WHERE id > ${lastId} ORDER BY id ASC LIMIT ${limit};`);
        query.stream({highWaterMark: 100})
        .pipe(esMap((data, cb) => cb(null, this._fix(data, fields))))
            .pipe(ndjson.serialize())
            .pipe(writeStream)
            .on('complete', function (job) {
              job.on('error', console.log)
                .on('complete', function (metadata) {
                  console.log('job completed', metadata);
                  console.log('Done in ', (new Date().getTime() - start) / 1000, 'seconds');
                  resolve();
                });
            })
            .on('error', reject);
      });
    });
  }

  _fix(row, fields) {
    let i = 0;
    for (var key in row) {
      if (row[key] === '0000-00-00 00:00:00') {
        row[key] = null;
      } else if (fields[i].type === 'BOOLEAN') {
        row[key] = row[key].lastIndexOf(1) !== -1;
      }
      i++;
    }
    return row;
  }

  _convertToBqColumnType(columnType) {
    const type = columnType.toLowerCase();
    if (type === 'tinyint(1)' || type === 'bit(1)') {
      return 'BOOLEAN'
    } else if (type.match(/int\([0-9]+\)$/)) {
      return 'INTEGER'
    } else if (type === 'datetime') {
      return 'TIMESTAMP'
    } else if (type === 'float' || type === 'double') {
      return 'FLOAT';
    }
    return 'STRING';
  }

}