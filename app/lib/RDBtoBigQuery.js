let mysql = require('mysql');
let bigquery = require('@google-cloud/bigquery');
let esMap = require('event-stream').map;

let ndjson = require('ndjson');

const LOAD_METHOD_SNAPSHOT = 'snapshot';
const LOAD_METHOD_APPEND = 'append';

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
    this.snapshotDataset = this.bq.dataset(process.env.BQ_DATASET_SNAPSHOTS);
  }

  exec(table, loadMethod) {
    return this._syncTable(table, loadMethod);
  }

  _syncTable(tableName, loadMethod) {
    return new Promise((resolve, reject) => {
      this._createOrUpdateTable(tableName, loadMethod).then(fields => {
        return this._insertRecords(fields, tableName, this.dataset, this.limit, loadMethod);
      }).then(_ => {
        resolve();
      }).catch(reject);
    });
  }

  _createOrUpdateTable(tableName, loadMethod) {
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

        console.log('=============== BQ schema ===================');
        console.log(options);
        console.log('=============== BQ schema ===================');

        const table = this.dataset.table(tableName);
        table.exists().then((data) => {
          var exists = data[0];
          if (exists && loadMethod === LOAD_METHOD_APPEND) {
            if (loadMethod === LOAD_METHOD_APPEND) {
              console.log(`Table ${tableName} exists in BigQuery, will use existing schema, beware of schema changes, not updating for now...`);
              resolve(json);
            }
          } else {
            var result = Promise.resolve();
            if (exists && loadMethod === LOAD_METHOD_SNAPSHOT) {
              console.log(tableName +  ' - Method is snapshot; moving old table to timestamped snapshot in snapshot dataset');

              const timestamp = new Date().toISOString().replace(/T/g, '').replace(/-/g, '').replace(/:/g, '').replace(/\./g, '');
              const destTableName = tableName + '_' + timestamp;
              const destTable = this.snapshotDataset.table(destTableName);
              const srcTable = this.dataset.table(tableName);
              let job;

              // Copies the table contents into another table
              result = result.then(() => {
                return srcTable.copy(destTable)
                  .then((results) => {
                    job = results[0];
                    console.log(`Copy Job ${job.id} started for table ${tableName} to ${destTableName}`);
                    return job.promise();
                  })
                  .then((results) => {
                    console.log(`Job ${job.id} completed.`);
                    return results;
                  });
              });
              result = result.then(() => {
                return srcTable.delete()
                  .then(() => {
                    console.log(`Table ${srcTable.id} deleted, will re-create it with new snapshot.`);
                  });
              })
            }
            result.then(() => {
              this.dataset.createTable(tableName, options, (error) => {
                if (error) return reject(error);
                // Give BQ some time before we start streaming data
                setTimeout(function () {
                  resolve(json);
                }, 3000);
              });
            });
          }
        });
      });
    });
  }

  _insertRecords(fields, tableName, dataset, limit, loadMethod) {
    const table = dataset.table(tableName);

    let writeStream = table.createWriteStream('json');
    let start = new Date().getTime();
    return new Promise((resolve, reject) => {
      let lastId = 0;
      var select = (loadMethod === LOAD_METHOD_SNAPSHOT) ? 'sum(0)' : 'max(id)'
      var query = 'SELECT ' + select + ' as maxId FROM [' + tableName + '] LIMIT 1';
      dataset.query(query).then((rows) => {
        // Handle results here.
        console.log(`Found existing maxId for ${tableName}: `, rows);
        lastId = rows[0][0].maxId !== null ? rows[0][0].maxId : 0;
        console.log(`Selecting new rows for ${tableName} from ${lastId} with a limit of ${limit}.`);
        let query_suffix = (loadMethod === LOAD_METHOD_SNAPSHOT) ? '' : (' WHERE id > ' + lastId + ' ORDER BY id ASC LIMIT ' + limit)
        let query = this.connection.query(`SELECT * FROM ${tableName}${query_suffix};`);
        query.stream({
            highWaterMark: 100
          })
          .pipe(esMap((data, cb) => cb(null, this._fix(data, fields))))
          .pipe(ndjson.serialize())
          .pipe(writeStream)
          .on('complete', function (job) {
            const runtimeInSeconds = (new Date().getTime() - start) / 1000;
            job.on('error', function (error) {
              console.error('Job failed with error', error);
              console.error('Failed after', runtimeInSeconds, 'seconds');
              reject(error);
            }).on('complete', function (metadata) {
              console.log('Job completed', metadata);
              console.log('Done in ', runtimeInSeconds, 'seconds');
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
        row[key] = row[key] !== null ? row[key].toString().lastIndexOf('1') !== -1 : null;
      }  else if (fields[i].type === 'BYTES') {
        row[key] = null;
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
    } else if (type === 'float' || type === 'double' || type.indexOf('decimal') > -1) {
      return 'FLOAT';
    } else if (type.indexOf('binary') > -1) {
      return 'BYTES';
    }
    return 'STRING';
  }

}
