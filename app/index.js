var RDBtoBigQuery = require('./lib/RDBtoBigQuery');

let sqlToBq = new RDBtoBigQuery();

var tablesToSend = process.env.TABLES.split(',');
sqlToBq.exec(tablesToSend).then(function (result) {
  console.log('All good, result: ', result);
  process.exit(0);
}).catch(function (error) {
  console.log(error);
});