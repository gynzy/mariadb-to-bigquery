var RDBtoBigQuery = require('./lib/RDBtoBigQuery');

let sqlToBq = new RDBtoBigQuery();

var tablesToSend = process.env.TABLES.split(',');
var result = Promise.resolve();
tablesToSend.forEach((table) => {
  result = result.then(() => {
    return sqlToBq.exec(table);    
  });
});
result.then(function (result) {
  console.log('All good, result: ', result);
  process.exit(0);
}).catch(function (error) {
  console.log(error);
});