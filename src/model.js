const query = require('./connect');
const Fields = require('./fields');


/**
 * `BaseModel`: 
 * constructor only provided to be inherited from when creating new classes.
 * an error gets thrown if an instances is created.
 * 
 * @param {object} opts 
 */
function BaseModel(opts) {
	throw Error(
		'BaseModel instances are not supported. ' +
		'Use BaseModel only with extend.'
	);
}


BaseModel.prototype.init = function() {};


// class inheritance ends
BaseModel.__base__ = null;
BaseModel.isDerivedFrom = isDerivedFrom;
BaseModel.extend = extend;


let models = { BaseModel };
module.exports = models;

/**
 * `validateModelFields`:
 * make sure `Field`s are provided for a given model and that they are the correct type.
 * also checks for the existence of a primary key.
 *   
 * @param {string} modelName 
 * @param {object} modelOpts 
 */
function validateModelFields(modelName, modelOpts) {
	if(!modelOpts.fields) {
		throw Error(`model fields not defined for DB Model: "${modelName}"`);
	}

  function MDErr(msg) {
    return Error(`'${modelName}' DB Model Validation: ${msg}`);
  }

	if(modelOpts.fields.constructor.name !== 'Object') {
		throw MDErr(`'fields' property must be an object`);
	}

	if(!Object.keys(modelOpts.fields).length) {
		throw MDErr('no Fields provided');
	}

  let primaryKeys = 0;
	let fields = modelOpts.fields; 
	for(let key in fields) {
		let field = fields[key];
    // is it a registered `Field` class type?
		if(Fields[field.constructor.name] === undefined) {
			throw MDErr(`'${key}' Field has unknown type: ${field.constructor.name}`);
		}

    // validate all fields for a model Field
    try {
      field.validateField(key);
    }
    catch(err) {
      throw MDErr(err.message);
    }

    // is primaryKey? should only have one total
    primaryKeys += field.options.primaryKey ? 1 : 0;
	}

  if(primaryKeys == 0) {
    throw MDErr(`does not have a primary key`);
  }
  else if(primaryKeys > 1) {
    throw MDErr(`contains more than one primary key`);
  }
}


/**
 * `validateModelClass`: 
 * validate the new Model's name and Fields.
 * 
 * @param {string} modelName 
 * @param {object} opts 
 */
function validateModelClass(modelName, opts) {
	if(!modelName || typeof modelName !== 'string') {
		throw Error(`model name not provided for DB Model`);
	}

	if(!opts.model) {
		throw Error(`model definition not provided for DB Model: "${modelName}"`);
	}

  if(opts.model.dbName && typeof opts.model.dbName !== 'string') {
    throw Error(`dbName must be string for DB Model: "${modelName}"`);
  }

	validateModelFields(modelName, opts.model);
} 

function prepareModelMeta(modelClass, props) {
  const _meta = {
    dbName: props.dbName === undefined ? modelClass.name.toLowerCase() : props.dbName,
    _dbNameFields: {},
    _related: {},
  };

  _meta.generateTableSQL = function() {
    const fields = [];
    for(let key in props.fields) {
      fields.push(props.fields[key].toTableSQL());
    }
    return `CREATE TABLE ${_meta.dbName} (\n  ${fields.join(', \n  ')}\n);`;
  };

  modelClass._meta = _meta;
  modelClass.prototype._meta = _meta;
}

function prepareModelFields(modelClass, props) {
  function MFError(msg) {
    throw Error(`${modelClass.name} Model Field Validation Error: ${msg}`);  
  }

  const _fields = props.fields;
  const _meta = modelClass._meta;

  for(let key in _fields) {
    const field = _fields[key]; 
    if(field.options.dbName != field.fieldName) {
        _meta._dbNameFields[field.options.dbName] = field;
    }

    if(field.constructor.name === 'ForeignKey') {
      const relatedModel = field.options.model;
      const reverseName = field.options.reverse;

      if(relatedModel._meta._related.hasOwnProperty(reverseName)) {
        let relatedField = relatedModel._meta._related[reverseName];
        let msg = `reverse name '${reverseName}' `;
        msg += `already exists on model '${relatedModel.name}'`;
        msg += ` (from ${relatedField.model.name} Model)`;
        MFError(msg);
      }
      
      // the "reverse" part... add the field to the related model's list.
      const relatedField = Fields.RelatedField({
        model: modelClass, field: field, pk: _fields.id
      });
      relatedField.validateField(reverseName);
      relatedModel._meta._related[reverseName] = relatedField;
    }
  }

  _meta.getDBFieldNames = function() {
    const fields = [];
    for(let key in _fields) {
      fields.push(_fields[key].options.dbName);
    }
    return fields;
  };

  _meta.getFieldNames = function() {
    let fields = Object.keys(_fields);
    fields = fields.concat(Object.keys(_meta._dbNameFields));
    return fields.concat(Object.keys(_meta._related));
  };

  _meta.getFieldByName = function(fieldName, includeRelated = true) {
    if(_fields.hasOwnProperty(fieldName)) {
      return _fields[fieldName];
    }
    if(_meta._dbNameFields.hasOwnProperty(fieldName)) {
      return _meta._dbNameFields[fieldName];
    }
    if(includeRelated && _meta._related.hasOwnProperty(fieldName)) {
      return _meta._related[fieldName];
    }
    return null;
  };

  _meta.getRelatedField = function(fieldName) {
    if(_meta._related.hasOwnProperty(fieldName)) {
      return _meta._related[fieldName];
    }
    return null;
  };
}


function setupORM(DBModel) {
  const QuerySet = require('./querySet');
  Object.defineProperty(DBModel, 'orm', {
    get: function() {
      return new QuerySet(DBModel);
    }
  });
}

function isDerivedFrom(baseModel) {
  if(!baseModel) return false;
  if(!baseModel.hasOwnProperty('__base__')) return false;

  let base = this.__base__;
  while(base != null) {
    if(base === baseModel) return true;
    base = base.__base__;
  }
  return false
}


/**
 * `extend`:
 * this method is automatically added as a property to a Model's constructor function.
 * it provides the ability to easily inherit from another Model.
 * does basic validation before returning a new constructor function.  
 * 
 * @param {string} modelName 
 * @param {object} props (properties) 
 * 
 * @return {constructor} 
 */
function extend(modelName, props = {}) {
  validateModelClass(modelName, props);

	let temp = {
		[modelName]: function(opts) {
			if(!(this instanceof temp[modelName])) {
				return new temp[modelName](opts);
			}

			this.init(opts);
		}
	};

	let DBModel = temp[modelName];
	DBModel.extend = extend;
  DBModel.__base__ = this;
  DBModel.isDerivedFrom = isDerivedFrom;

  // "hidden" fields on the prototype
  let modelProps = props.model;
  delete props.model;


	DBModel.prototype = Object.create(this.prototype);
	Object.assign(DBModel.prototype, props);
	DBModel.prototype.constructor = DBModel;

  prepareModelMeta(DBModel, modelProps);
  prepareModelFields(DBModel, modelProps);
  setupORM(DBModel);
	return DBModel;
}


models.Account = BaseModel.extend('Account', {
	model: {
		fields: {
			id: Fields.AutoSerial({primaryKey: true, nullable: false}),
			email: Fields.CIText({nullable: true, unique: true})
		}
	}
});


models.Name = BaseModel.extend('Name', {
	model: {
		fields: {
			id: Fields.AutoSerial({primaryKey: true, nullable: false}),
			account: Fields.ForeignKey({model: models.Account, reverse: 'name'}),
			first: Fields.Text({value: 'Awesome!'}),
			last: Fields.Text({nullable: false}),
		}
	}
});


models.Test = BaseModel.extend('Test', {
  model: {
    fields: {
      id: Fields.AutoSerial({primaryKey: true, nullable: false}),
      account: Fields.ForeignKey({model: models.Account, nullable: false}),
      name: Fields.Text({nullable: true}),
      comment: Fields.Text({nullable: true})
    }
  }
});


models.Yo = models.Name.extend('Yo', {
  model: {
    fields: {
      id: Fields.AutoSerial({primaryKey: true, nullable: false}),
    }
  }
});


/*
Name.filter({first: "luke"}).req().next((result) => {
	console.log(result);
});
*/

module.exports = models;