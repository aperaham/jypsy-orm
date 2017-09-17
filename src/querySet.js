const _query = require('./connect');
const _models = require('./model').models;
const { JoinTree, JoinType } = require('./joinTree.js');


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


function JoinsNotAllowedError(instance, fieldName) {
  if(!(this instanceof JoinError)) {
    return new JoinError(instance, fieldName);
  }
  this.name = 'JoinsNotAllowedError';
  this.stack = (new Error()).stack;
  const msg = `Join not allowed for field: ${fieldName}`;
  this.message = `${instance._model.name} Model QuerySet Error: ${msg}`;
}
JoinsNotAllowedError.prototype = Object.create(Error.prototype);
JoinsNotAllowedError.prototype.constructor = JoinsNotAllowedError;


function QuerySet(model = null) {
  if(!(this instanceof QuerySet)) {
    return new QuerySet(model);
  }

  if(!model.isDerivedFrom(_models.BaseModel)) {
    throw Error('QuerySet Error: model not provided');
  }

  this._model = model;
  this._init();
}


function splitJoinFields(field) {
  const joins = [];
  let index = 0;
  let joinType;
  let regResult = null;
  let skip;

  // '.' character is right join, '__' is left join
  const reg = new RegExp('\\.|__');

  while(regResult = reg.exec(field)) {
    index = regResult.index;

    if(regResult[0]  == '.') {
      joinType = JoinType.INNER;
      skip = 1;
    }

    else {
      joinType = JoinType.LEFT;
      skip = 2;
    }

    joins.push({
      join: joinType,
      field: field.slice(0, index)
    });

    field = field.slice(index + skip);
  }

  if(field.length) {
    joins.push({
      join: null,
      field: field
    });
  }

  return joins;
}


function FieldDoesNotExistError(fieldName, meta, model) {
  const choices = meta.getFieldNames().join(', ');
  let msg = `field '${fieldName}' doesn't exist in ${model.name} model.`;
  msg += ` choices are: ${choices}`;
  throw QSError(this, msg);
}


function buildJoins(joins) {
  let meta = this._model._meta;
  let model = this._model;

  let node = this._joinTree.getFirstNode();

  for(let i = 0; i < joins.length; i++) {
    const fieldName = joins[i].field;
    const joinType = joins[i].join;

    const field = meta.getFieldByName(fieldName);

    if(!field) {
      FieldDoesNotExistError.call(this, fieldName, meta, model);
    }

    if(!field.options.model) continue;

    model = field.options.model;
    meta = model._meta;

    // don't create join if this is the last FK field
    if(field.constructor.name === 'ForeignKey' && i == joins.length - 1) {
      continue;
    }

    node = this._joinTree.findOrCreateNode(node, field, joinType);
  }
}


function _visitJoinTreeNodes(tree) {
  let results = '';
  const keys =  Object.keys(tree);

  for(let i = 0; i < keys.length; i++) {
    let model = keys[i];

    for(let joinType in tree[model]) {
      let node = tree[model][joinType];
      results += `${joinType} JOIN ${node.field.alias}`;
      results += ' ' + _visitJoinTreeNodes(node.tree);
    }
  }

  return results;
}


/**
 * `generateJoinSQL`:
 * build the join tree and return join sql as a string
 */
function generateJoinSQL() {
  this._joinTree.reset();
  let queryFields;

  switch(this._qType) {
    case null:
    case QueryType.VALUES_LIST:
      queryFields = this._selectFields;
      break;

    default:
      queryFields = null;
  }

  if(queryFields != null) {
    queryFields.forEach(i => buildJoins.call(this, i));
  }

  this._distinctFields.forEach(i => buildJoins.call(this, i));
  this._orderFields.forEach(i => buildJoins.call(this, i));

  this._filters.forEach(i => buildJoins.call(this, i.join));
  this._notFilters.forEach(i => buildJoins.call(this, i.join));

  // return join SQL string
  return this._joinTree.generateJoinSQL();
}



function validateJoins(joins) {
  let meta = this._model._meta;
  let model = this._model;

  for(let i = 0; i < joins.length; i++) {
    const fieldName = joins[i].field;
    const joinType = joins[i].join;

    let field = meta.getFieldByName(fieldName);

    if(!field) {
      FieldDoesNotExistError.call(this, fieldName, meta, model);
    }

    if(!field.options.model) continue;

    model = field.options.model;
    meta = model._meta; 
  }
}


function validateField(fieldName, allowJoins = true) {
  if(typeof fieldName !== 'string') {
    throw QSError(this, `got ${fieldName} with type ${typeof fieldName} but must be string!`);
  }
 
  const joins = splitJoinFields(fieldName);

  if(joins.length > 1 && !allowJoins) {
    throw JoinsNotAllowedError(this, fieldName);
  }

  if(!joins.length) {
    let meta = this._model._meta;
    FieldDoesNotExistError.call(this, fieldName, meta, this._model);
  }

  validateJoins.call(this, joins);
  // buildJoins.call(this, joins);
  return joins;
}


function getSelectFields(subQueryDepth = 0) {
  if(this._selectFields.length == 0) {
    
    if(subQueryDepth > 0) {
      // this is a subquery and no select fields have been specifically selected. 
      // in this case, implicitly 'select' the primary key
      let field = this._model._meta.getModelPK();
      return field.nameToSQL();
    }

    // get all fields in the model if no fields were initially selected
    const fields = this._model._meta.getDBFieldNames();
    const modelName = this._model._meta.dbName;

    let selectFields = [];

    for(let i = 0; i < fields.length; i++) {
      selectFields.push(`"${modelName}"."${fields[i]}"`);
    }

    return selectFields;
  }

  let selectFields = this._selectFields.map(i => {
    const field = this._joinTree.findField(i);
    return field.nameToSQL();
  });
  
  return selectFields.join(', ');
}


function getUpdateFields(values = []) {
  const paramIndex = values.length;
  const keys = Object.keys(this._updateFields);
  let outValues = [];

  const updateFields = this._updateFields.map((item, index) => {
    const field = this._joinTree.findField(item.join);
    const name = field.options.dbName;

    outValues.push(item.value);
    return `"${name}" = $${paramIndex + index + 1}`
  });

  return {
    SQL: `SET ${updateFields.join(', ')}`,
    values: values.concat(outValues)
  };
}


function getInsertSQL(values = []) {
  const paramIndex = values.length;
  let outValues = [];
  let sqlInsertParams = [];

  const fieldNames = this._insertFields.map((item, index) => {
    const field = this._joinTree.findField(item.join);
    const name = field.options.dbName;

    outValues.push(item.value);
    sqlInsertParams.push(`$${paramIndex + index + 1}`);
    return `"${name}"`
  });

  return {
    SQL: `(${fieldNames.join(', ')}) VALUES (${sqlInsertParams.join(', ')}) RETURNING *`,
    values: values.concat(outValues)
  };  
}


function processQueryFilters(inValues = [], depth = 0, isNotQuery = false) {
  if(depth > 0 && 
      this._qType != QueryType.VALUES_LIST && this._qType != null) {
    throw QSError(this, `subquery must be 'SELECT'!`);
  }

  let result = { SQL: '', values: inValues.slice()};

  const filters = isNotQuery ? this._notFilters : this._filters;
  if(filters.length === 0) return result;

  let sqlWhere = [];
  let outValues = result.values;
  let paramCount = inValues.length;
  let paramIndex = 1;

  for(let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    let q = filter.value;

    if(typeof q === 'undefined') {
      throw QSError(this, `filter key is undefined!`);
    }

    //let field = validateField.call(this, key);
    const field = this._joinTree.findField(filter.join);
    const fieldName = field.nameToSQL();
    //const fieldName = `"${field.parentModel._meta.dbName}"."${field.options.dbName}"`;

    switch(q !== null && q.constructor.name) {
      case 'QuerySet': 
        const subQuery = generateSQL.call(q, outValues, depth + 1);
        sqlWhere.push(`${fieldName} IN (${subQuery.SQL})`);
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
        sqlWhere.push(`${fieldName} IN (${arraySQL.join(', ')})`);
        paramCount = outValues.length;
        break;

      default:
        if(q === null) {
          sqlWhere.push(`${fieldName} IS NULL`);
          break;
        }
        sqlWhere.push(`${fieldName} = $${paramIndex + paramCount}`);
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


function generateOrderBySQL() {
  if(!this._orderFields.length) return '';

  const order = this._orderFields.map((join, i) => {
    const field = this._joinTree.findField(join);

    if(this._orderDescending[i]) {
      return `${field.nameToSQL()} DESC`;
    }
    return field.nameToSQL();
  });

  return `ORDER BY ${order.join(', ')}`;
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
    const fieldName = args[i];
    const joins = validateField.call(this, fieldName);
    fieldList.push(joins);
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


function convertJoinToSubQuery() {
  const querySet = this._clone();
  querySet._qType = QueryType.VALUES_LIST;

  const qType = this._qType;
  let propName = null;
  let prop;

  // reset the queryset and reassign 
  switch(qType) {
    case QueryType.UPDATE:
      propName = '_updateFields';
      prop = this._updateFields;
      break;

    case QueryType.INSERT:
      propName = '_insertFields'
      prop = this._insertFields;
      break;
  }

  this._init();
  this._qType = qType;
  
  if(propName) this[propName] = prop;

  const pkName = this._model._meta.getModelPK().options.dbName;
  if(querySet._filters.length) {
    const clone = this.filter({[pkName]: querySet});
    this._filters = clone._filters;
  }
}


function generateFilterSQL(values, subQueryDepth) {
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
    if(this._qType === QueryType.INSERT) {
      throw QSError(this, `insert does not support filtering`);
    }
    filterSQL = `WHERE ${filterSQL}`;
  }

  return {
    SQL: filterSQL,
    values: outValues
  };
}


function generateDeleteSQL(values, subQueryDepth) {
  return {
    SQL: `DELETE FROM "${this._model._meta.dbName}"`,
    values
  };
}


function generateUpdateSQL(values, subQueryDepth) {
  let updateSQL = getUpdateFields.call(this, values);
  const SQL = `UPDATE "${this._model._meta.dbName}" ${updateSQL.SQL}`;

  return {
    SQL,
    values: updateSQL.values
  };
}


function generateInsertSQL(values, subQueryDepth) {
  let insertSQL = getInsertSQL.call(this, values);

  return {
    SQL: `INSERT INTO "${this._model._meta.dbName}" ${insertSQL.SQL}`,
    values: insertSQL.values
  };
}


function generateSelectSQL(values, subQueryDepth) {
  let selectFields = getSelectFields.call(this, subQueryDepth);

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

  let tableName = this._model._meta.dbName;
  return {
    SQL: `SELECT ${selectFields} FROM "${tableName}"`,
    values
  };
}


function generateQueryTypeSQL(values, subQueryDepth) {

  switch(this._qType) {
    case null:
    case QueryType.VALUES_LIST:
      return generateSelectSQL.call(this, values, subQueryDepth);

    case QueryType.UPDATE:
      return generateUpdateSQL.call(this, values, subQueryDepth);

    case QueryType.DELETE:
      return generateDeleteSQL.call(this, values, subQueryDepth);

    case QueryType.INSERT:
      return generateInsertSQL.call(this, values, subQueryDepth);

    default:
      // ??
      throw QSError(this, `unknown query type: ${this._qType}`);
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
  let joinSQL = generateJoinSQL.call(this);

  if(joinSQL.length) {
    switch(this._qType) {
      // update and delete need to convert from join queries to subqueries to work correctly
      case QueryType.DELETE:
      case QueryType.UPDATE:
        convertJoinToSubQuery.call(this);
        joinSQL = '';
        break;

      case QueryType.INSERT:
        // insert can't use joins or WHERE clause
        joinSQL = '';
        break;
    }
  }

  const filterSQL = generateFilterSQL.call(this, values, subQueryDepth);
  const queryTypeSQL = generateQueryTypeSQL.call(this, filterSQL.values, subQueryDepth);
  let SQL = queryTypeSQL.SQL;

  if(joinSQL.length) {
    SQL += ' ' + joinSQL;
  }

  // add 'where' filter SQL
  if(filterSQL.SQL.length) {
    SQL += ` ${filterSQL.SQL}`;
  }

  if(this._qType === null || this._qType === QueryType.VALUES_LIST) {
    const orderBySQL = generateOrderBySQL.call(this);
    if(orderBySQL.length) {
      SQL += ` ${orderBySQL}`;
    }
  }

  return {
    values: queryTypeSQL.values,
    SQL: SQL
  };
}


QuerySet.prototype._init = function() {

  /**
   * `_qType`:
   * tracks the type of database operation.
   * update, delete, insert, select, etc...
   */
  this._qType = null;

  this._joinTree = new JoinTree(this._model);

  this._distinctFields = [];
  this._isDist = false;

  /**
   * `_filters`:
   * used to calculate the `WHERE` sql clause
   */
  this._filters = [];
  this._notFilters = [];

  this._insertFields = [];

  /**
   * `_orderFields`:
   * an array of strings containing the names of fields to be places in the ORDER BY clause.
   * fields are marked as ordered by ASC by default. 
   * to order by DESC, prepend '-' character to string. 
   */
  this._orderFields = [];

  /**
   * `_orderDescending`:
   * an array of bools (true/false) 
   * if true, the field will be marked as DESC (descending order). 
   * `_orderDescending` contains a 1 to 1 correspondence with the `_orderFields` array.
   * example:
   * this._orderFields =     ['id',      '-total', 'email'];
   * this._orderDescending = [ false,     true,     false];
   */
  this._orderDescending = [];

  this._selectFields = [];
  this._updateFields = null;
};


function validateQueryFields(query, methodType, allowJoins = true) {
  if(typeof query !== 'object') {
    throw QSError(this, `'${methodType}' query accepts only object`);
  }

  const keys = Object.keys(query);
  const joinList = [];

  for(let i = 0; i < keys.length; i++) {
    let key = keys[i];
    try {
      const joins = validateField.call(this, key, allowJoins);
      joinList.push({join: joins, value: query[key]});
    }
    catch(err) {
      if(err instanceof JoinsNotAllowedError) {
        throw QSError(this, `'${methodType}' query does not allow joins`);
      }
      throw err;
    }
  }
  return joinList;
}


/**
 * @param {object} fields
 */
QuerySet.prototype.filter = function(fields = {}) {
  const fieldsList = validateQueryFields.call(this, fields, 'filter');

  let clone = this._clone();
  clone._filters = fieldsList;
  return clone;
};


QuerySet.prototype.not = function(fields = {}) {
  const fieldsList = validateQueryFields.call(this, fields, 'not');

  let clone = this._clone();
  clone._notFilters = fieldsList;
  return clone;
};


QuerySet.prototype.delete = function() {
  if(arguments.length) {
    throw QSError(this, `delete does not take parameters`);
  }
  
  const clone = this._clone();
  validateChainedQueries.call(clone, QueryType.DELETE);
  return clone;
};


QuerySet.prototype.insert = function(fields = {}) {
  // don't allow joins for insert
  const fieldsList = validateQueryFields.call(this, fields, 'insert', false);

  const clone = this._clone();
  validateChainedQueries.call(clone, QueryType.INSERT);
  clone._insertFields = fieldsList;
  return clone; 
};


QuerySet.prototype.update = function(fields = {}) {
  // no joins for updates
  const fieldsList = validateQueryFields.call(this, fields, 'update', false);

  let clone = this._clone();
  validateChainedQueries.call(clone, QueryType.UPDATE);
  clone._updateFields = fieldsList;
  return clone;
};


QuerySet.prototype.distinct = function() {
  argsAreStringsOrThrow(QueryType.DISTINCT, arguments);
  let clone = this._clone();
  clone._distinctFields = [];
  clone._isDist = true;
  processQueryFields.call(clone, QueryType.DISTINCT, arguments);
  return clone;
};


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
};


QuerySet.prototype.valuesList = function() {
  argsAreStringsOrThrow(QueryType.VALUES_LIST, arguments);
  let clone = this._clone();
  validateChainedQueries.call(clone, QueryType.VALUES_LIST);
  clone._selectFields = [];
  processQueryFields.call(clone, QueryType.VALUES_LIST, arguments);
  return clone;
};


function cloneQuerySetProp(prop) {
  if(prop === null || prop === undefined) return prop;
  
  switch(prop.constructor.name) {
    case QuerySet.name:
      return prop._clone();

    case JoinTree.name:
      return prop.clone();

    case Array.name:
      return prop.slice();

    default:
      if(typeof prop === 'function') return prop;
      return JSON.parse(JSON.stringify(prop));
  }
}


QuerySet.prototype._clone = function() {
  let clone = Object.assign({}, this);

  const keys = Object.keys(clone);
  for(let i = 0; i < keys.length; i++) {
    const propName = keys[i];

    if(!clone.hasOwnProperty(propName)) continue;
    clone[propName] = cloneQuerySetProp(clone[propName]);
  }

  Object.setPrototypeOf(clone, QuerySet.prototype);
  return clone;
};


/**
 * `_querySQL`:
 * for debug purposes. shows the sql generated by query
 * 
 * @returns String of sql
 */
QuerySet.prototype._querySQL = function() {
  return generateSQL.call(this).SQL;
};


/**
 * `reqHandler`:
 * for each QueryType, return QuerySet query data in a way that is consistent with 
 * the query type
 */
function reqHandlerDeleteUpdate(res) {
  return Promise.resolve(res.rowCount);
}


function reqHandlerSelectInsert(res) {
  return Promise.resolve(res.rows);
}

const reqHandler = {};

reqHandler[QueryType.DELETE] = reqHandlerDeleteUpdate;
reqHandler[QueryType.UPDATE] = reqHandlerDeleteUpdate;
reqHandler[QueryType.INSERT] = reqHandlerSelectInsert;
reqHandler[QueryType.VALUES_LIST] = reqHandlerSelectInsert;

function reqError(err) {
  return Promise.reject(err);
};


/**
 * `req`:
 *  short for 'request':
 * run the query returning a promise
 */
QuerySet.prototype.req = function() {
  const query = generateSQL.call(this);
  let promise = _query.query(query.SQL, query.values);

  const qType = this._qType !== null ? this._qType : QueryType.VALUES_LIST;  
  return promise.then(reqHandler[qType], reqError);
};


module.exports = QuerySet;