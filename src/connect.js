const pg = require('pg');


let pool = null ;
let showQueryLog = false;


/**
* dbConfig:
* {
*  user: 'XXX',
*  database: 'XXX',
*  password: 'XXX',
*  host: 'localhost',
*  port: 5432,
*  max: 10, 
*  idleTimeoutMillis: 10000, 
* };
**/
module.exports.create = function(dbConfig) {
  if(pool) {
    throw Error(`connection pool already created!`);
  }

  pool = new pg.Pool(dbConfig);

  pool.on('error', function (err, client) {
    console.error('idle client error', err.message, err.stack);
  });
};


module.exports.showQueryLog = function(show) {
  if(typeof show !== 'boolean') return;
  showQueryLog = show;
};


module.exports.query = function (text, values, callback) {
  if(!pool) {
    throw Error(`pool does not exist! use 'create' first!`);
  }
  if(showQueryLog) {
    console.log('SQL: ', text, values);
  }
  return pool.query(text, values, callback);
};