
function CreateField(baseField, name, classProps) {
  let constructor = {
    [name]: function(opts = {}) {
      if(!(this instanceof constructor[name])) {
        return new constructor[name](opts);
      }
      this.construct(opts);
    }
  };

  let newField = constructor[name];
  newField.prototype = Object.create(baseField.prototype);
  Object.assign(newField.prototype, classProps);
  newField.prototype.constructor = newField;
  newField.FieldType = name;

  return newField;
}


function FieldError(instance, message) {
  return Error(`${instance.constructor.name} Field '${instance.fieldName}' ${message}`);
}


function BaseField(opts = {}) {
  if(!(this instanceof BaseField)) {
      return new BaseField(opts);
  }
}


/**
 * default values passed in or omitted during construction
 * will get assigned to `this.options`
 */
BaseField.prototype.defaults = {
  nullable: true,
  primaryKey: false,
  value: undefined,
  unique: false,
  dbName: undefined
};


/**
 * basic 'static' field props
 */
BaseField.prototype.field= { sqlType: '' };


/**
 * `applyOptionDefaults`:
 * apply the defaults to `this.options`
 * only apply the defaults if an option doesn't already explicitly exist
 */
BaseField.prototype.applyOptionDefaults = function() {
  // apply default values to the field if they weren't already provided
  for(let key in this.defaults) {
    if(!(key in this.options)) {
      // set all field default options unless it's undefined
      if(this.defaults[key] === undefined) continue;
      this.options[key] = this.defaults[key];
    }
  }
}


/**
 * `parseDefaultOptions`:
 * make sure that we're dealing with the correct types.
 * example: the `primaryKey` option should not be a string. 
 * it should a be boolean only
 */
BaseField.prototype.parseDefaultOptions = function() {
  let opts = this.options;
  for(let key in this.defaults) {
    let defaultType = typeof this.defaults[key];
    if(defaultType === 'undefined') continue;

    if((key in opts) && typeof opts[key] !== defaultType) {
      throw FieldError(this, `'${key}' option must be type '${defaultType}'`);
    } 
  }
  this.applyOptionDefaults();

  // some common option mixtures which don't make sense. being a stifler about it...
  if(opts.primaryKey && opts.unique) {
    throw FieldError(this, 'is marked primary key and unique. choose only one');
  }

  if(opts.primaryKey && opts.nullable) {
    throw FieldError(this, 'cannot be a primary key and be nullable');
  }

  this.validateDefaultValue();
  this.validateDefaults();
};


/**
 * `validateDefaultValue`:
 * each field may allow a default value to be set.
 * validation code can go here for each class type.
 */
BaseField.prototype.validateDefaultValue = function() {
}


/**
 * `validateDefaults`:
 * validate any default values specific to this Field class
 */
BaseField.prototype.validateDefaults = function() {}


/**
 * `construct`:
 * Field class specific setup code here.
 * Run when an instance is created.
 * 
 * @param {object} (required) must accept an object of Field options
 */
BaseField.prototype.construct = function(opts) {
  this.options = opts;
};


/**
 * `validateField`:
 * parses and validates incoming options.
 * `validateField` method is run by the model which it is attached to for validation purposes.
 * the model passes its assigned name to this method.
 * can be overridden for each Field class, but probably won't be necessary.
 * 
 * @param {string} (required) the name of the field passed from the model
 */
BaseField.prototype.validateField = function(fieldName, parentModel) {
  this.fieldName = fieldName;
  
  if(this.options.dbName === undefined) {
    this.options.dbName = fieldName;
  }

  if(typeof parentModel !== 'function' || !parentModel.hasOwnProperty('isDerivedFrom')) {
    throw FieldError(this, 'parent model not DBModel');
  }
  this.parentModel = parentModel;

  // validate here
  if(typeof this.options !== 'object') {
    throw FieldError(this, 'options must be an object!');
  }

  this.parseDefaultOptions();
};


/**
 * function is called by the DBModel's setup phase.
 * do whatever a field want's to do with it.
 * the function is called at a later time when the DBModel is nearly configured.
 */
BaseField.prototype.initParentModel = function() {

}


/**
 * `typeToSQL`:
 * The method should format `this.field.sqlType` in a way which returns compatible SQL.
 * 
 * all Fields should set their own `this.field.sqlType` to the SQL equivalent.
 * example: `this.field.sqlType = varchar`
 */
BaseField.prototype.typeToSQL = function() {
  return this.field.sqlType;
};


/**
 * `defaultToSQL`:
 * format the field's "default" value for SQL.
 * example: strings must be quoted. 
 * A Field may choose override this method.
 */
BaseField.prototype.defaultToSQL = function() {
  if(typeof this.options.value === 'string') {
    return `'${this.options.value}'`;
  }
  return this.options.value;
};


/**
 * `toTableSQL`:
 * return a string of sql which can be used directly for creating a table
 */
BaseField.prototype.toTableSQL = function() {
  let sql = `${this.options.dbName} ${this.typeToSQL()}`;
  if(!this.options.nullable) {
    sql += ' NOT NULL';
  }
  if(this.options.value !== undefined) {
    sql += ` DEFAULT ${this.defaultToSQL()}`;
  }
  if(this.options.primaryKey) {
    sql += ' PRIMARY KEY'
  }
  if(this.options.unique) {
    sql += ' UNIQUE'
  }
  return sql;
};


/**
 * `Fields`:
 * the primary Field class registry
 */
const Fields = {
  CreateField,
  BaseField
};


Fields.Varchar = CreateField(BaseField, 'Varchar', {
  field: {
    sqlType: 'varchar'
  },
  typeToSQL: function() {
    return `${this.field.sqlType}(${this.options.maxSize})`;
  },
  validateDefaultValue: function() {
    const valueType = typeof this.options.value;
    if(valueType !== 'undefined' && valueType !== 'string') {
      throw FieldError(this, 'default value must be undefined or string');
    }

    if(typeof this.options.maxSize !== 'number') {
      throw FieldError(this, 'maxSize required and must be an integer');
    }
    // should be an integer without decimal float point
    let intValue = parseInt(this.options.maxSize);
    if(intValue <= 0) {
      throw FieldError(this, `maxSize must be greater than 0`);
    }

    if((this.options.maxSize - intValue) > 0) {
      throw FieldError(this, `maxSize should be an integer without float point decimal`);
    }
    this.options.maxSize = intValue;
  }  
});


Fields.AutoSerial = CreateField(BaseField, 'AutoSerial', {
  field: {
    sqlType: 'bigserial'
  },
});


Fields.Text = CreateField(BaseField, 'Text', {
  field: {
    sqlType: 'text'
  }  
});


/**
 * case-insensitive text field
 */
Fields.CIText = CreateField(BaseField, 'CIText', {
  field: {
    sqlType: 'citext'
  }  
});


Fields.SmallInt = CreateField(BaseField, 'SmallInt', {
  field: {
    sqlType: 'smallint'
  },
  getMaxIntSize: function() {
    return 0x8000;
  },
  validateDefaultValue: function() {
    if(this.options.value === undefined) {
      return;
    }
    if(typeof this.options.value !== 'number') {
      throw FieldError(this, 'default value must be an integer');
    }
    // should be an integer without decimal float point
    let intValue = parseInt(this.options.value);
    let sign = intValue < 0 ? -1 : 1;

    // detect a decimal place...
    if(((this.options.value - intValue) * sign) > 0) {
      throw FieldError(this, `default value should be an integer without float point decimal`);
    }

    let maxSize = this.getMaxIntSize();
    if(intValue > maxSize || intValue < -maxSize) {
      throw FieldError(this, `default value exceeds max limit (${-maxSize} to +${maxSize})`);
    }
    this.options.value = intValue;
  }  
});


Fields.Integer = CreateField(Fields.SmallInt, 'Integer', {
  field: {
    sqlType: 'integer'
  },
  getMaxIntSize: function() {
    // 32 bits / 2 
    return 0x80000000;
  },  
});


Fields.BigInt = CreateField(Fields.SmallInt, 'BigInt', {
  field: {
    sqlType: 'bigint'
  },
  getMaxIntSize: function() {
    // 64 bits / 2
    return 0x8000000000000000;
  },  
});


Fields.Boolean = CreateField(BaseField, 'Boolean', {
  field: {
    sqlType: 'boolean'
  },
  validateDefaultValue: function() {
    if(this.options.value === undefined) {
      return;
    }
    if(typeof this.options.value !== 'boolean') {
      throw FieldError(this, 'default value must be a boolean');
    }
  }  
});


Fields.ForeignKey = CreateField(Fields.BaseField, 'ForeignKey', {
  defaults: {
    nullable: true,
    primaryKey: false,
    value: undefined,
    unique: false,
    model: undefined,
    // reverse: the 'reverse' relation name
    reverse: undefined,
  },
  typeToSQL: function() {
    return `bigint REFERENCES ${this.options.model._meta.dbName}`;
  },
  validateField: function(fieldName, parentModel) {
    if(this.options.dbName === undefined) {
      this.options.dbName = fieldName + '_id';
    }
    BaseField.prototype.validateField.call(this, fieldName, parentModel);
  },
  validateDefaults: function() {
    let opts = this.options;
    if(opts.primaryKey) {
      throw FieldError(this, `cannot be a primaryKey`);
    }
    if(typeof opts.model === 'undefined') {
      throw FieldError(this, `'model' option is required and must be a DBModel class`);
    }

    if(typeof opts.model !== 'function' || !opts.model.hasOwnProperty('isDerivedFrom')) {
      throw FieldError(this, `'model' option is required and must be a DBModel class`);
    }

    if(typeof opts.reverse !== 'undefined' && typeof opts.reverse !== 'string') {
      throw FieldError(this, `reverse name must be string or undefined`);
    }
  },
  initParentModel: function() {
    if(!this.options.reverse) {
      this.options.reverse = this.parentModel._meta.dbName;
    }
  }
});


Fields.RelatedField = CreateField(Fields.ForeignKey, 'RelatedField', {
  typeToSQL: function() {
    throw FieldError(this, `field not for SQL purposes`);
  },
  validateDefaults: function() {
    //Fields.ForeignKey.prototype.validateDefaults.call(this);
    const opts = this.options;
    if(!opts.field) {
      throw FieldError(this, 'requires Field');
    }
  }
});

module.exports = Fields;