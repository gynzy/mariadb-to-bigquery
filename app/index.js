process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

var RDBtoBigQuery = require('./lib/RDBtoBigQuery');

let sqlToBq = new RDBtoBigQuery();

var tablesToSend = process.env.TABLES.split(',');
var result = Promise.resolve();
tablesToSend.forEach((table) => {
  let tableProperties = table.split(':');
  if (tableProperties.length === 2 && (tableProperties[1] === 'append' || tableProperties[1] === 'snapshot')) {
    result = result.then(() => {
      return sqlToBq.exec(tableProperties[0],tableProperties[1]);    
    }).catch(function (error) {
      console.error(table, 'Error occured sending tables:', error);
      process.exit(1);
    });
  } else {
    console.error('table option not formatted correct, use comma separated list of `tablename:append` or `tablename:snapshot`, got: ' + table);
    process.exit(1);
  }
});
result.then(function (result) {
  console.log('All good, result: ', result);
  process.exit(0);
}).catch(function (error) {
  console.error('Error occured sending tables:', error);
  process.exit(1);
});
