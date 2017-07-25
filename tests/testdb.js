const pg = require('pg');
const events = require('events');

const tables = {};


function TestDataBase(opts = {}) {
  if(!(this instanceof TestDataBase)) {
    return new TestDataBase(opts);
  }

  clientConnect.call(this, opts);
}


TestDataBase.prototype = Object.create(events.prototype);
TestDataBase.prototype.constructor = TestDataBase;
TestDataBase.prototype._con = null;


/**
 * return sql
 * @param {Array} data Array of objects describing the data to insert
 * @param {String} tableName the name of the table to generate sql for
 *   
 * @returns {object} SQL and values
 */
function insertSQL(data, tableName) {
  const keys = Object.keys(data[0]);
  let values = []; 
  let insertParams = [];

  let paramCount = 0;
  for(let i = 0; i < data.length; i++) {
    values = values.concat(keys.map(k => data[i][k]));
    const params = keys.map((k, kIndex) => `$${(++paramCount)}`);
    insertParams.push(`(${params.join(', ')})`);
  }

  let query = `INSERT INTO ${tableName} (${keys.join(', ')}) `;
  query += `VALUES ${insertParams.join(', ')}`;
  return { SQL: query, values: values };
};


TestDataBase.prototype.populateCustomers = function() {
  const result = insertSQL(tables._data.customer, 'customer');
  return this._con.query(result.SQL, result.values);
};


/**
 * make a connection to the postgresql server
 * @param {object} opts 
 */
function clientConnect(opts) {
  this._con = new pg.Client(opts);
  this._con.connect(onConnect.bind(this));
}


/**
 * callback for when the client makes a connection (or fails to connect)
 *
 * @param {object} err - the `Client.connect` method returns an error object
 * on failure which gets passed through to `err`
 * 
 * @fires `dbConnected` event
 */
function onConnect(err) {
  if(err) throw err;
  this.emit('dbConnected', this._con);
  let promise = dropTables.call(this);
  promise = promise.then(createTables.bind(this));
  promise.catch(err => {
    this.emit('error', err);
  }); 
}


/**
 * drop the test db tables if the exist. relies on specific order.
 * @fires `droppedTables` event when finished dropping all tables
 * @returns {Object} Promise object
 */
function dropTables() {
  let dropSQL = '';
  for(let i = 0; i < tables._tableOrder.length; i++) {
    let tableName = tables._tableOrder[i];
    dropSQL += `drop table if exists "${tableName}";\n`;
  }
  return this._con.query(dropSQL).then(result => {
    this.emit('droppedTables', null);
  });
}


/**
 * creates test tables (should be run after `dropTables`)
 * @fires `tablesCreated` event when finished
 * @returns {object} Promise
 */
function createTables() {
  let tableSQL = '';
  // create tables in reverse order so that field constraints are valid
  for(let i = tables._tableOrder.length - 1; i > -1; i--) {
    const tableName = tables._tableOrder[i];
    tableSQL += tables[tableName];
  }

  return this._con.query(tableSQL).then(() => {
    this.emit(`tablesCreated`, this);
  });
}


function closeConnection() {
  this._con.end((err) => {
    if(err) throw err;
    this.emit('dbClosed', null);
  });
}


tables.customer = `
  create table customer (
    id bigserial PRIMARY KEY NOT NULL,
    first text NOT NULL,
    last text 
  );`;


tables.order = `
  create table "order" (
    id bigserial PRIMARY KEY NOT NULL,
    customer_id bigint REFERENCES customer NOT NULL,
    is_paid boolean NOT NULL
  );`;


tables.item = `
  create table item (
    id bigserial PRIMARY KEY NOT NULL,
    name text NOT NULL,
    price_cents integer NOT NULL,
    is_pizza boolean NOT NULL
  );`;


tables.topping = `
  create table topping (
    id bigserial PRIMARY KEY NOT NULL,
    name text NOT NULL,
    price_cents int NOT NULL
  );`;


tables.item_topping = `
  create table item_topping (
    id bigserial PRIMARY KEY NOT NULL,
    order_id bigint REFERENCES "order" NOT NULL,
    item_id bigint REFERENCES item NOT NULL,
    topping_id bigint REFERENCES topping
  );`;


tables._tableOrder = [
  'item_topping',
  'topping',
  'item',
  'order',
  'customer'
];

tables._data = {};
tables._data.customer = [
  { id: '1', first: 'Willard J', last: 'Willard' },
  { id: '2', first: 'Apple B', last: 'Saucey' },
  { id: '3', first: 'Steve', last: 'Brule' },
  { id: '4', first: 'Pablo', last: 'Meyers' },
  { id: '5', first: 'Steve', last: 'Jonson' }
];


module.exports = {
  TestDataBase,
  tables
};