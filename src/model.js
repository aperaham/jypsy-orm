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


function setInstanceFields(propFields) {
  const keys = this._meta.getFieldNames();
  for(let i = 0; i < keys.length; i++) {
    const key = keys[i];
    this[key] = (key in propFields) ? propFields[key] : undefined;
  }
}


BaseModel.prototype.init = function(opts) {
  setInstanceFields.call(this, opts);
};


// class inheritance ends
BaseModel.__base__ = null;
BaseModel.isDerivedFrom = isDerivedFrom;
BaseModel.extend = extend;


let models = { BaseModel };
module.exports = {
  models
};


/**
 * `validateModelFields`:
 * make sure `Field`s are provided for a given model and that they are the correct type.
 * also checks for the existence of a primary key.
 * 
 * deletes the fields from the opts and stores them separately.
 *   
 * @param {string} modelName 
 * @param {object} modelOpts 
 * 
 * @returns {object} new object containing fields
 */
function validateModelFields(DBModel, opts) {
  function MDErr(msg) {
    return Error(`'${DBModel.name}' DB Model Validation: ${msg}`);
  }

  const modelFields = {};
  const optKeys = Object.keys(opts);

  for(let i = 0; i < optKeys.length; i++) {
    let key = optKeys[i];
    let optValue = opts[key];

    if(!(optValue instanceof Fields.BaseField)) {
      continue;
    }

    modelFields[key] = optValue;
    delete opts[key];
  }

  if(Object.keys(modelFields).length == 0) {
    throw MDErr(`model has no fields!`);
  }

  let primaryKeys = 0;
	let fields = modelFields; 
	for(let key in fields) {
		let field = fields[key];
    // validate all fields for a model Field
    try {
      field.validateField(key, DBModel);
    }
    catch(err) {
      throw MDErr('validateField error: ' + err.message);
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

  return modelFields;
}

/**
 * if `model` props exists in a Model's class definition, make sure it's valid.
 * deletes the props from the class and stores them separately.
 * 
 * @param {string} modelName 
 * @param {object} modelProps 
 * 
 * @returns {object} formatted 'model' object (may have no properties)
 */
function validateModelProps(DBModel, props) {
  let modelProps = props.model;
  if(!modelProps) return {};

  if(typeof modelProps !== 'object') {
		throw Error(`DB Model: "${DBModel.name}" 'model' property must be object`);
  }

  if(modelProps.dbName && typeof modelProps.dbName !== 'string') {
    throw Error(`dbName must be string for DB Model: "${DBModel.name}"`);
  }

  const newProps = Object.create(modelProps);
  delete props.model;
  return newProps;
}


/**
 * `validateModelClass`: 
 * basic DBModel prop validation
 * 
 * @param {string} modelName 
 * @param {object} opts 
 * 
 */
function validateModelClass(modelName, opts) {
	if(!modelName || typeof modelName !== 'string') {
		throw Error(`model name not provided for DB Model`);
	}

  if(typeof opts !== 'object' || Object.keys(opts).length == 0) {
    throw Error(`DB Model "${modelName}" does not have definition!`);
  }
} 


function prepareModelMeta(modelClass, props) {
  const model = props.model;
  const _meta = {
    dbName: model.dbName === undefined ? modelClass.name.toLowerCase() : model.dbName,
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

  // find pk
  let pkField;
  (() => {
    let f = props.fields;
    for(let k in f) {
      if(f[k].options.primaryKey) {
        pkField = f[k];
        break;
      }
    }
  })();

  _meta.getModelPK = function() {
    return pkField;
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
    field.initParentModel();

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
        msg += ` (from ${relatedField.options.model.name} Model)`;
        MFError(msg);
      }
      
      // the "reverse" part... add the field to the related model's list.
      const relatedField = Fields.RelatedField({
        model: modelClass, field: field
      });
      relatedField.validateField(reverseName, relatedModel);
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

  const modelProps = validateModelProps(DBModel, props);
	const fieldProps = validateModelFields(DBModel, props);
  const metaProps = { model: modelProps, fields: fieldProps };

	DBModel.prototype = Object.create(this.prototype);
	Object.assign(DBModel.prototype, props);
	DBModel.prototype.constructor = DBModel;

  prepareModelMeta(DBModel, metaProps);
  prepareModelFields(DBModel, metaProps);
  setupORM(DBModel);
	return DBModel;
}
