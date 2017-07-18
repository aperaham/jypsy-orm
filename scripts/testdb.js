const pg = require('pg');
const events = require('events');

const tables = {};

function TestDataBase(opts = {}) {
  if(!(this instanceof TestDataBase)) {
    return new TestDataBase(opts);
  }

  clientConnect.call(this, opts);
}


TestDataBase.prototype = events.prototype;
TestDataBase.prototype.constructor = TestDataBase;
TestDataBase.prototype._con = null;


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
  promise = promise.then(closeConnection.bind(this));
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
  for(let i = tables._tableOrder.length - 1; i > -1; i--) {
    const tableName = tables._tableOrder[i];
    tableSQL += tables[tableName];
  }

  return this._con.query(tableSQL).then(() => {
    this.emit(`tablesCreated`, null);
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


module.exports = TestDataBase;