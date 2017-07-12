const _query = require('./connect');
const _models = require('./model');


const QueryType = {
  VALUES_LIST: 'valuesList',
  DISTINCT: 'distinct',
  ORDER_BY: 'order',
  UPDATE: 'update',
  DELETE: 'delete',
  INSERT: 'insert'
};


function QSError(instance, msg) {
  return Error(`${instance._model.name} Model QuerySet Error: ${msg}`);
}


function QuerySet(model = null) {
  if(!(this instanceof QuerySet)) {
    return new QuerySet(model);
  }

  try {
    if(!model.isDerivedFrom(_models.BaseModel)) {
      throw Error();
    }
  }
  catch(err) {
    throw Error('QuerySet Error: model not provided');
  }

  this._init({});
  this._model = model;
}


function splitJoinFields(field) {
  const joins = [];
  let index = 0;
  let isLeftJoin;
  let regResult = null;
  let skip;
  const reg = new RegExp('\\.|__');

  while(regResult = reg.exec(field)) {
    index = regResult.index;
    if(regResult[0]  == '.') {
      isLeftJoin = false;
      skip = 1;
    }
    else {
      isLeftJoin = true;
      skip = 2;
    }
    joins.push({
      leftJoin: isLeftJoin,
      field: field.slice(0, index)
    });
    field = field.slice(index + skip);
  }
  if(field.length) {
    joins.push({
      leftJoin: false,
      field: field
    });
  }
  return joins;
}


function FieldDoesNotExistError(fieldName, meta, model) {
  const choices = meta.getFieldNames().join(', ');
  let msg = `field '${fieldName}' doesn't exist in ${model.name} model.`
  msg += ` choices are: ${choices}`;
  throw QSError(this, msg);
}


function validateFieldJoins(joins) {
  let meta = this._model._meta;
  let fieldModel = this._model;
  let joinSelectFields = [];

  let field;
  for(let i = 0; i < joins.length; i++) {
    let fieldName = joins[i].field;
    field = meta.getFieldByName(fieldName);
    if(!field) {
      FieldDoesNotExistError.call(this, fieldName, meta, fieldModel);
    }
    if(field.options.model) {
      meta = field.options.model._meta;
      fieldModel = field.options.model;
    }
  }
  return field;
}


function validateField(fieldName) {
  if(typeof fieldName !== 'string') {
    throw QSError(this, `got ${fieldName} with type ${typeof fieldName} but must be string!`);
  }

  let meta = this._model._meta;
  const joins = splitJoinFields(fieldName);

  if(!joins.length) {
    FieldDoesNotExistError.call(this, fieldName, meta, this._model);
  }
  if(joins.length > 1) {
    return validateFieldJoins.call(this, joins);
  }
  
  let field = meta.getFieldByName(fieldName);
  if(!field) {
    field = meta.getRelatedField(fieldName);
    if(!field) {
      FieldDoesNotExistError.call(this, fieldName, meta, this._model);
    }
    field = field.options.pk;
  }
  return field;
}


function getSelectFields() {
  let selectFields;
  if(this._selectFields.length == 0) {
    // get all fields in the model if no fields were initially selected
    selectFields = this._model._meta.getDBFieldNames();
  }
  else {
    selectFields = this._selectFields;
  }
  return selectFields.join(', ');
}


function getUpdateFields(values = []) {
  const paramIndex = values.length;
  const keys = Object.keys(this._updateFields);
  let outValues = [];
  let sqlUpdateParams = [];

  for(let i = 0; i < keys.length; i++) {
    let fieldName = keys[i];

    let dbName = validateField.call(this, fieldName).options.dbName;
    sqlUpdateParams.push(`${dbName} = $${paramIndex + i + 1}`);
    outValues.push(this._updateFields[fieldName]);
  }

  return {
    SQL: `SET ${sqlUpdateParams.join(', ')}`,
    values: values.concat(outValues)
  };
}


function getInsertSQL(values = []) {
  const paramIndex = values.length;
  const keys = Object.keys(this._insertFields);
  let outValues = [];
  let sqlInsertParams = [];
  let insertKeys = [];

  for(let i = 0; i < keys.length; i++) {
    let q = keys[i];

    let field = validateField.call(this, q);
    insertKeys.push(field.options.dbName);
    sqlInsertParams.push(`$${paramIndex + i + 1}`);
    outValues.push(this._insertFields[q]);
  }

  return {
    SQL: `(${insertKeys.join(', ')}) VALUES (${sqlInsertParams.join(', ')}) RETURNING *`,
    values: values.concat(outValues)
  };  
}


function processQueryFilters(inValues = [], depth = 0, isNotQuery = false) {
  if(depth > 0 && 
      this._qType != QueryType.VALUES_LIST && this._qType != null
  ) {
    throw QSError(this, `subquery must be 'SELECT'!`);
  }

  let result = { SQL: '', values: inValues.slice()};
  let whereValues = isNotQuery ? this._notFilters : this._filters;
  let keys = Object.keys(whereValues);
  if(keys.length === 0) return result;

  let sqlWhere = [];
  let outValues = result.values;
  let paramCount = inValues.length;
  let paramIndex = 1;

  for(let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let q = whereValues[key];

    let field = validateField.call(this, key);

    switch(q !== null && q.constructor.name) {
      case 'QuerySet': 
        const subQuery = generateSQL.call(q, outValues, depth + 1);
        sqlWhere.push(`${field.options.dbName} IN (${subQuery.SQL})`);
        outValues = subQuery.values;
        paramCount = outValues.length;
        break;

      case 'Array':
        let arraySQL = [];
        const tempParamCount = paramIndex + paramCount;
        for(let x = 0; x < q.length; x++) {
          arraySQL.push(`$${tempParamCount + x}`);
          outValues.push(q[x]);
        }
        sqlWhere.push(`${field.options.dbName} IN (${arraySQL.join(', ')})`);
        paramCount = outValues.length;
        break;

      default:
        if(q === null) {
          sqlWhere.push(`${field.options.dbName} IS NULL`);
          break;
        }
        sqlWhere.push(`${field.options.dbName} = $${paramIndex + paramCount}`);
        ++paramIndex;
        outValues.push(q);
        break;
    }
  }

  if(isNotQuery) {
    result.SQL = `NOT ${sqlWhere.join(' AND NOT ')}`;
  }
  else {
    result.SQL = `${sqlWhere.join(' AND ')}`;
  }
  result.values = outValues;
  return result;
};


function joinDesc(orderStr, field, desc) {
  orderStr += field;
  if(desc) {
    orderStr += ' DESC';
  }
  return orderStr;
}

function getOrderFields() {
  let orderBy = '';

  let len = this._orderFields.length - 1; 
  for(let i = 0; i < len; i++) {
    orderBy = joinDesc(orderBy, this._orderFields[i], this._orderDescending[i]);
    orderBy += ', ';
  }
  if(len > -1) {
    orderBy = joinDesc(orderBy, this._orderFields[len], this._orderDescending[len]);
    orderBy = `ORDER BY ${orderBy}`;
  }

  return orderBy;
}


function processQueryFields(queryType = QueryType.VALUES_LIST, args) {
  let fieldList;

  switch(queryType) {
    case QueryType.VALUES_LIST:
      fieldList = this._selectFields;
      break;

    case QueryType.DISTINCT:
      fieldList = this._distinctFields;
      break;

    case QueryType.ORDER_BY:
      fieldList = this._orderFields;
      break;

    default:
      // wtf
      throw Error("not implemented!");
  }

  for(let i = 0; i < args.length; i++) {
    let fieldName = args[i];
    let field = validateField.call(this, fieldName);
    fieldList.push(field.options.dbName);
  }
}


/**
 * `validateChainedQueries`:
 * check for the case where a query changed from anything other than what it started as. 
 * chaining select -> delete -> update won't work.  for example, queries like:
 * valuesList('id', 'name').update({id: 5, name: 'Wilson'}).delete() should throw an error.
 * you can overwrite existing queries of the same type, however, though there will be only
 * 1 output. example: valuesList('id', 'name').valuesList('email', 'age'); 
 * will run the latter query retrieving email and age.
 * otherwise, use only 1 query "type" at a time (per `req` call).
 * 
 * @param {enum from QueryType object} queryType 
 */
function validateChainedQueries(queryType) {
  if(this._qType != null && this._qType != queryType) {
    throw QSError(this, `multiple query types.`);
  }
  this._qType = queryType;
}


/**
 * `argsAreStringsOrThrow`:
 * loop through args to make sure that all of the elements are strings
 * 
 * @param {enum (from QueryType)} QueryType 
 * @param {Array (or Array-like (arguments))} args 
 */
function argsAreStringsOrThrow(QueryType, args) {
  for(let i = 0; i < args.length; i++) {
    if(typeof args[i] !== 'string') {
      throw Error(`${QueryType} Error: argument ${i} (${args[i]}) should be a string!`);
    }
  }
}


/**
 * `generateSQL`:
 * generate the final query from a QuerySet. may be used recursively to generate
 * subquery expressions.
 *  
 * @param {Array} values
 *   at list of parameterized query values generated by this function
 * 
 * @param {Integer} subQueryDepth
 *   recursion depth, to keep track of subquery count
 */
function generateSQL(values = [], subQueryDepth = 0) {  
  let whereQuery = processQueryFilters.call(this, values, subQueryDepth);
  let notInQuery = processQueryFilters.call(this, whereQuery.values, subQueryDepth, true)
  let outValues = notInQuery.values.slice();
  let filterSQL = '';

  if(whereQuery.SQL.length) {
    filterSQL += whereQuery.SQL; 
  }
  if(whereQuery.SQL.length && notInQuery.SQL.length) {
    filterSQL += ` AND ${notInQuery.SQL}`;
  }
  else if(notInQuery.SQL.length) {
    filterSQL += notInQuery.SQL;
  }
  if(filterSQL.length) {
    filterSQL = `WHERE ${filterSQL}`;
  }

  let selectFields = getSelectFields.call(this);

  let tableName = this._model._meta.dbName;
  if(this._isDist) {
    // append the distinct fields
    if(this._distinctFields.length > 0) {
      let distinct = this._distinctFields.join(', ');
      selectFields = `DISTINCT ON (${distinct}) ${selectFields}`;
    }
    else {
      selectFields = `DISTINCT ${selectFields}`;
    } 
  }

  let orderBy = '';
  let queryTypeSQL;
  switch(this._qType) {
    case null:
    case QueryType.VALUES_LIST:
      queryTypeSQL = `SELECT ${selectFields} FROM ${tableName}`;
      orderBy = getOrderFields.call(this);
      break;

    case QueryType.UPDATE:
      let updateSQL = getUpdateFields.call(this, outValues);
      queryTypeSQL = `UPDATE ${tableName} ${updateSQL.SQL}`;
      outValues = updateSQL.values;
      break;

    case QueryType.DELETE:
      queryTypeSQL = `DELETE FROM ${tableName}`;
      // blank out order because it isn't valid for 'DELETE'
      break;

    case QueryType.INSERT:
      let insertSQL = getInsertSQL.call(this, outValues);
      queryTypeSQL = `INSERT INTO ${tableName} ${insertSQL.SQL}`;
      outValues = insertSQL.values;
      break;

    default:
      // ??
      throw QSError(this, `unknown query type: ${this._qType}`);
  }

  let SQL = queryTypeSQL;
  if(filterSQL.length) {
    SQL += ` ${filterSQL}`;
  }
  if(orderBy.length) {
    SQL += ` ${orderBy}`;
  }
  return {
    values: outValues,
    SQL: SQL
  };
}


QuerySet.prototype._init = function(fields) {};


/**
 * @param {object} fields
 */
QuerySet.prototype.filter = function(fields = {}) {
  if(typeof fields !== 'object') {
    throw QSError(this, 'filter accepts only object');
  }
  let clone = this._clone();
  clone._filters = fields;
  return clone;
};


QuerySet.prototype.not = function(fields = {}) {
  if(typeof fields !== 'object') {
    throw QSError(this, 'filter accepts only object');
  }
  let clone = this._clone();
  clone._notFilters = fields;
  return clone;
};


QuerySet.prototype.delete = function() {
  const clone = this._clone();

  if(clone._qType != null && clone._qType != QueryType.VALUES_LIST) {
    throw QSError(clone, `multiple query types.`);
  }
  clone._qType = QueryType.DELETE;
  return clone;
}

QuerySet.prototype._insertFields = {};
QuerySet.prototype.insert = function(fields = {}) {
  if(typeof fields !== 'object') {
    throw QSError(this, `insert must contain fields in the form of an object`);
  }

  const clone = this._clone();
  validateChainedQueries.call(clone, QueryType.INSERT);
  clone._insertFields = fields;
  return clone; 
}


/**
 * `_qType`:
 * tracks the type of database operation.
 * update, delete, insert, select, etc...
 */
QuerySet.prototype._qType = null;
QuerySet.prototype._distinctFields = [];
QuerySet.prototype._isDist = false;


/**
 * `_filters`:
 * used to calculate the `WHERE` sql clause
 */
QuerySet.prototype._filters = {};
QuerySet.prototype._notFilters = {};


QuerySet.prototype.distinct = function() {
  argsAreStringsOrThrow(QueryType.DISTINCT, arguments);
  let clone = this._clone();
  clone._distinctFields = [];
  clone._isDist = true;
  processQueryFields.call(clone, QueryType.DISTINCT, arguments);
  return clone;
}


/**
 * `_orderFields`:
 * an array of strings containing the names of fields to be places in the ORDER BY clause.
 * fields are marked as ordered by ASC by default. 
 * to order by DESC, prepend '-' character to string. 
 */
QuerySet.prototype._orderFields = [];


/**
 * `_orderDescending`:
 * an array of bools (true/false) 
 * if true, the field will be marked as DESC (descending order). 
 * `_orderDescending` contains a 1 to 1 correspondence with the `_orderFields` array.
 * example:
 * this._orderFields =     ['id',      '-total', 'email'];
 * this._orderDescending = [ false,     true,     false];
 */
QuerySet.prototype._orderDescending = [];


QuerySet.prototype.order = function() {
  argsAreStringsOrThrow(QueryType.order, arguments);
  let clone = this._clone();
  clone._orderFields = [];
  clone._orderDescending = [];
  let args = [];

  for(let i = 0; i < arguments.length; i++) {
    let orderField = arguments[i];
    let isDescending = orderField.startsWith('-');
    clone._orderDescending.push(isDescending);

    // need to remove the '-' (descend) option from args.
    args.push(isDescending ? orderField.slice(1) : orderField);
  }
  processQueryFields.call(clone, QueryType.ORDER_BY, args);
  return clone;
}


QuerySet.prototype._selectFields = [];


QuerySet.prototype.valuesList = function() {
  argsAreStringsOrThrow(QueryType.VALUES_LIST, arguments);
  let clone = this._clone();
  validateChainedQueries.call(clone, QueryType.VALUES_LIST);
  clone._selectFields = [];
  processQueryFields.call(clone, QueryType.VALUES_LIST, arguments);
  return clone;
};


QuerySet.prototype._updateFields = null;
QuerySet.prototype.update = function(fields = {}) {
  if(typeof fields !== 'object') {
    throw QSError(this, 'update accepts only object of fields!');
  }

  let clone = this._clone();
  validateChainedQueries.call(clone, QueryType.UPDATE);
  clone._updateFields = fields;
  return clone;
};


QuerySet.prototype._clone = function() {
  let clone = Object.assign({}, this);
  Object.setPrototypeOf(clone, QuerySet.prototype);
  return clone;
}


/**
 * `req`:
 *  short for 'request':
 * run the query returning a promise
 */
QuerySet.prototype.req = function() {
  const query = generateSQL.call(this);
  let promise = _query.query(query.SQL, query.values);
  
  function errHandler(err) {
    console.log(`QuerySet Error: ${err.message}`);
    return Promise.resolve([]);
  }

  function successHandler(res) {
    console.log(res);
    return Promise.resolve(res.rows);
  }

  return promise.then(successHandler, errHandler);
}


module.exports = QuerySet;