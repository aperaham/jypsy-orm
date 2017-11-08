/**
 * JoinTree 
 * 
 * helper utilities for managing join query relationships
 */


/**
 * this enum is used to determine the type of JOIN operation
 */
const JoinType = {
  LEFT: 'LEFT',
  INNER: 'INNER',
  RIGHT: 'RIGHT'
};


/**
 * QueryField
 * 
 * a class that abstracts the utility of model fields common operations.
 * @param {object} field
 *   `field` should be an instance of a model's Field
 *  
 * @param {string} alias 
 *   `alias` is the join table alias, as in the following sql example:
 *   `JOIN customer AS cust1 ON cust1.purchase_id == purchased.id` ...
 */
function QueryField(field, alias) {
  if(!(this instanceof QueryField)) {
    return new QueryField(field, alias);
  }

  this._field = field;
  this._alias = alias;
}


/**
 * nameToSQL
 * 
 * returns a field's name with alias for use to be referenced in a query
 * @returns {string} of SQL
 */
QueryField.prototype.nameToSQL = function() {
  return `"${this._alias}"."${this._field.options.dbName}"`;
};


/**
 * toJoinSQL
 * 
 * returns the join query text of the relation to this field. 
 * this method finds related fields and follows its model's relations. example output:
 * `JOIN "customer" AS "cust" ON  "cust"."id" = "related_table"."customer_id"`
 * 
 * @returns {string} of SQL
 */
QueryField.prototype.toJoinSQL = function(joinType, parentAlias) {
  return this._field.toJoinSQL(joinType, this._alias, parentAlias);
};


/**
 * JoinTree
 * 
 * this class manages the tree of related fields and their query types
 * that get referenced in a given QuerySet's query. 
 * it caches the result of relations so that subsequent queries that follow the 
 * same relations can reuse the fields. 
 * 
 * Example for the following join query:
 *   `Customer.orm.filter({ purchases__items__category__name: "Hats" })`
 * 
 *   the QuerySet will generate joins which look like the following SQL:
 *     `SELECT "customer".* from "customer"
 *      LEFT JOIN "purchase" ON "purchase"."customer_id" = "customer"."id"
 *      LEFT JOIN "item" ON "item"."purchase_id" = "purchase"."id"
 *      LEFT JOIN "category" ON "category"."id" = "item"."category_id"
 *      WHERE "category"."name" = "Hats"`
 * 
 *   and the resulting join tree will have the following nodes
 *     *(root) -> purchase -> item -> category
 *                                          | name
 * 
 * Now we can use the tree to "complete" other queries in the chain. For instance,
 * if we took the original query and sorted by item price:
 *    ```
 *      Customer.orm.filter({ purchases__items__category__name: "Hats" })
 *        .orderBy('purchases__items__price');
 *    ```
 *    
 *    the query will walk the join tree and find the correct field ("price" field):
 *      *(root) -> purchase -> item -> category
 *                               | price     | name
 *               
 * @param {object} Model class (not an instance)
 */
function JoinTree(model) {
  if(!(this instanceof JoinTree)) {
    return new JoinTree();
  }

  this._model = model;
  this.reset();
};


// return copy of the JoinTree
JoinTree.prototype.clone = function() {
  const clone = Object.assign({}, this);
  clone._joinMap = Object.assign({}, this._joinMap);
  clone._joinMap.models = Object.assign({}, this._joinMap.models);
  clone._joinMap.tree = Object.assign({}, this._joinMap.tree);
  Object.setPrototypeOf(clone, JoinTree.prototype);
  return clone;
}


JoinTree.prototype.reset = function() {
  this._joinMap = {
    models: { [this._model._meta.dbName]: 1 },
    tree: {}
  };
};


JoinTree.prototype.getFirstNode = function() {
  return this._joinMap;
};


/**
 * visitJoinTreeNodes
 * 
 * 
 * a "private" method that generates an SQL JOIN statement 
 * for every field in the join tree, using recursion. 
 * 
 * @param {object} tree
 *   the join tree node to operate on.
 *  
 * @param {object} prevField
 *   the previous field operated on. this is used to pass on any aliases.
 * 
 * @returns {string}
 *   a string of SQL 
 */
function visitJoinTreeNodes(tree, prevField = null) {
  let results = '';
  const keys =  Object.keys(tree);

  const pAlias = prevField ? prevField._alias : null;

  for(let i = 0; i < keys.length; i++) {
    let model = keys[i];

    for(let joinType in tree[model]) {
      let node = tree[model][joinType];
      results += node.field.toJoinSQL(joinType, pAlias);
      results += ' ' + visitJoinTreeNodes(node.tree, node.field);
    }
  }

  return results;
}


/**
 * generateJoinSQL
 * 
 * generates a JOIN statement for every field in the jointree
 * 
 * @returns {string}
 *   a string of SQL
 */
JoinTree.prototype.generateJoinSQL = function() {
  return visitJoinTreeNodes(this._joinMap.tree);
};


JoinTree.prototype.findOrCreateNode = function(node, field, joinType) {
  const modelName = field.options.model._meta.dbName;
  const nodeTree = node.tree;

  // left join or inner join?
  let link = nodeTree[modelName];
  if(!link) {
    return createJoinNode.call(this, nodeTree, modelName, field, joinType);
  }
  
  let join = link[joinType];
  if(!join) {
    link[joinType] = createJoinNodeType.call(this, modelName, field);
    join = link[joinType];
  }

  return join;  
};


/**
 * findField
 * 
 * queries the join tree for a field.
 * 
 * @param {Array} joins
 *   a precomputed array of objects which represent the path of the joins. For example: 
 *    
 *   the following ORM query: `Customer.orm.valuesList('purchases__items__price')`
 *   gets pre-processed to determine if `'purchases__items__price'` is a valid
 *   join query. the following validated result is an Array of joins that looks
 *   similar to this: ["purchases", "items", "price"]
 * 
 * @returns {object} 
 *   an instance of a JoinTree QueryField
 */
JoinTree.prototype.findField = function(joins) {
  let node = this._joinMap.tree;
  let prevNode = null;

  for(let i = 0; i < joins.length; i++) {
    let join = joins[i];

    if(join.join == null) {
      if(prevNode == null) {
        return this._model._meta.getFieldByName(join.field);
      }
      const field = prevNode.field._field;
      const joined = field.options.model._meta.getFieldByName(join.field);
      return QueryField(joined, prevNode.field._alias);
    }

    node = node[join.field];
    if(!node) return;
    
    node = node[join.join];
    if(!node) return;

    prevNode = node;
    node = node.tree;
  }
};


/**
 * createJoinNodeType
 * 
 * a "private" method 
 * used to create join tree nodes
 * 
 * @param {string} modelName 
 * @param {object} field 
 *   an instance of a Model Field
 * 
 * @returns {object}
 *   a new join tree node
 */
function createJoinNodeType(modelName, field) {
  const models = this._joinMap.models;
  let alias;

  if(!(modelName in models)) {
    models[modelName] = 1;
    alias = modelName;
  }
  else {
    models[modelName] += 1;
    alias = `${modelName}__T${models[modelName]}`;
  }
  
  return {
    field: QueryField(field, alias),
    tree: {}
  };
}


function createJoinNode(node, modelName, field, joinType) {
  const newJoin = createJoinNodeType.call(this, modelName, field);
  const newNode = {
    [joinType]: newJoin
  };

  node[modelName] = newNode;
  return newNode[joinType];
}


module.exports = {
  JoinTree,
  JoinType
};