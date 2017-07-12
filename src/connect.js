const pg = require('pg');


let pool = null;

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


module.exports.query = function (text, values, callback) {
  if(!pool) {
    throw Error(`pool does not exist! use 'create' first!`);
  }
  console.log('query:', text, values);
  return pool.query(text, values, callback);
};