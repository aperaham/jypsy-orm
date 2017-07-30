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

  let query = `INSERT INTO "${tableName}" (${keys.join(', ')}) `;
  query += `VALUES ${insertParams.join(', ')}`;
  return { SQL: query, values: values };
};


TestDataBase.prototype.populateCustomers = function() {
  const result = insertSQL(tables._data.customer, 'customer');
  return this._con.query(result.SQL, result.values);
};


TestDataBase.prototype.populateOrders = function() {
  const result = insertSQL(tables._data.order, 'order')
  return this._con.query(result.SQL, result.values);
}


TestDataBase.prototype.populateItems = function() {
  const result = insertSQL(tables._data.order, 'item')
  return this._con.query(result.SQL, result.values);
}


TestDataBase.prototype.populateToppings = function() {
  const result = insertSQL(tables._data.order, 'topping')
  return this._con.query(result.SQL, result.values);
}


TestDataBase.prototype.populateOrderItems = function() {
  const result = insertSQL(tables._data.order, 'order_item')
  return this._con.query(result.SQL, result.values);
}


TestDataBase.prototype.populateItemToppings = function() {
  const result = insertSQL(tables._data.order, 'item_topping')
  return this._con.query(result.SQL, result.values);
}


TestDataBase.prototype.populateAllTables = function() {
  const reversed = [];
  // create tables in reverse order so that field constraints are valid
  for(let i = tables._tableOrder.length - 1; i > -1; i--) {
    const tableName = tables._tableOrder[i];
    reversed.push(tableName);
  }

  let promise = reversed.reduce((prev, cur) => {
    const insert = insertSQL(tables._data[cur], cur);
    return prev.then(() => this._con.query(insert.SQL, insert.values).then(res => {
      this.emit('tablePopulated', {name: cur, insert});
    }));
  }, Promise.resolve());

  return promise.then(() => {
    this.emit(`tablesPopulated`, this);
  });
}


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
 * @fires `tableCreated` when a single table has been created
 * @fires `tablesCreated` event when finished
 * @returns {object} Promise
 */
function createTables() {
  const reversed = [];
  // create tables in reverse order so that field constraints are valid
  for(let i = tables._tableOrder.length - 1; i > -1; i--) {
    const tableName = tables._tableOrder[i];
    reversed.push(tableName);
  }

  let promise = reversed.reduce((prev, cur) => {
    const tableSQL = tables[cur];
    return prev.then(() => this._con.query(tableSQL).then(res => {
      this.emit('tableCreated', {name: cur, SQL: tableSQL});
    }));
  }, Promise.resolve());

  return promise.then(() => {
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
    customer_id bigint REFERENCES customer ON DELETE SET NULL,
    is_paid boolean NOT NULL
  );`;


tables.item = `
  create table item (
    id bigserial PRIMARY KEY NOT NULL,
    name text NOT NULL,
    price_cents integer NOT NULL,
    is_pizza boolean NOT NULL
  );`;


tables.order_item = `
  create table order_item (
    id bigserial PRIMARY KEY NOT NULL,
    order_id bigint REFERENCES "order" NOT NULL,
    item_id bigint REFERENCES item NOT NULL
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
    order_item_id bigint REFERENCES "order_item" NOT NULL,
    topping_id bigint REFERENCES "topping"
  );`;


tables._tableOrder = [
  'item_topping',
  'topping',
  'order_item',
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


tables._data.order = [
  { id: '1', customer_id: '1', is_paid: true }, // willard paid
  { id: '2', customer_id: '3', is_paid: false }, // steve brule didn't pay
  { id: '3', customer_id: '3', is_paid: true },
  { id: '4', customer_id: '2', is_paid: true }
];


tables._data.item = [
  { id: 1, name: 'Small Pizza', price_cents: 550, is_pizza: true },
  { id: 2, name: 'Medium Pizza', price_cents: 875, is_pizza: true },
  { id: 3, name: 'Large Pizza', price_cents: 1250, is_pizza: true },
  { id: 4, name: 'Tall-man Stout Soda', price_cents: 250, is_pizza: false },
  { id: 5, name: '6 Buffalo Wings', price_cents: 750, is_pizza: false },
  { id: 6, name: '24 Buffalo Wings', price_cents: 1420, is_pizza: false },
  { id: 7, name: 'Red Pepper Flakes Pack', price_cents: 0, is_pizza: false }
];


tables._data.topping = [
  { id: 1, name: 'Pepperoni', price_cents: 100 },
  { id: 2, name: 'Mushrooms', price_cents: 50 },
  { id: 3, name: 'Onions', price_cents: 50 },
  { id: 4, name: 'Peppers', price_cents: 75 },
  { id: 5, name: 'Sausage', price_cents: 100 },
  { id: 6, name: 'Extra Cheese', price_cents: 150 },
  { id: 7, name: 'Extra Sauce', price_cents: 100 },
]


tables._data.order_item = [
  // steve brule's order: large pizza, soda, 24 wings, pepper flakes
  { id: 1, order_id: 2, item_id: 3 },
  { id: 2, order_id: 2, item_id: 4 },
  { id: 3, order_id: 2, item_id: 6 },
  { id: 4, order_id: 2, item_id: 7 },

  // willard: medium mushroom pizza , 6 wings
  { id: 5, order_id: 1, item_id: 2 },
  { id: 6, order_id: 1, item_id: 5 },

  // brule tried to get a bunch of pepper flakes - for free!
  { id: 7, order_id: 3, item_id: 7 },
  { id: 8, order_id: 3, item_id: 7 },
  { id: 9, order_id: 3, item_id: 7 },

  // apple b: large pizza, extra sauce, extra cheese + small pizza with peppers
  { id: 10, order_id: 4, item_id: 3 },
  { id: 11, order_id: 4, item_id: 1 },
];


tables._data.item_topping = [
  // steve brule's large pizza: pepperoni, sausage, onions
  { id: 1, order_item_id: 1, topping_id: 1 },
  { id: 2, order_item_id: 1, topping_id: 5 },
  { id: 3, order_item_id: 1, topping_id: 3 },

  // willard's mushroom pizza
  { id: 4, order_item_id: 5, topping_id: 2 },

  // apple b lrg pizza, extra sauce, extra cheese
  { id: 5, order_item_id: 10, topping_id: 6 },
  { id: 6, order_item_id: 10, topping_id: 7 },
  // apple b sml pizza, peppers
  { id: 7, order_item_id: 11, topping_id: 4 },
];


module.exports = {
  TestDataBase,
  tables
};