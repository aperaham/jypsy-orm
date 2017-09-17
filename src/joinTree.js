

const JoinType = {
  LEFT: 'LEFT',
  INNER: 'INNER',
  RIGHT: 'RIGHT'
};


function QueryField(field, alias) {
  if(!(this instanceof QueryField)) {
    return new QueryField(field, alias);
  }

  this._field = field;
  this._alias = alias;
}


QueryField.prototype.nameToSQL = function() {
  return `"${this._alias}"."${this._field.options.dbName}"`;
};


QueryField.prototype.toJoinSQL = function(joinType, parentAlias) {
  return this._field.toJoinSQL(joinType, this._alias, parentAlias);
};


function JoinTree(model) {
  if(!(this instanceof JoinTree)) {
    return new JoinTree();
  }

  this._model = model;
  this.reset();
};


// return copy of the JoinTree
JoinTree.prototype.clone = function() {
  // TODO: get this working
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