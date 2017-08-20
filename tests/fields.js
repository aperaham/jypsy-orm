const expect = require('chai').expect;
const testUtils = require('./util');
const jypsyORM = require('../index');
const models = jypsyORM.model.models;
const fields = jypsyORM.fields;
const getCustomerModel = testUtils.getCustomerModel;


describe('General Field Validations', function() {
  describe('Varchar Field', function() {
    it(`name is 'Varchar'`, function() {
      expect(fields.Varchar.FieldType).to.equal('Varchar');
    });

    it('throws for default value not being string', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Varchar({value: 5});
        field.validateField('fieldName', Customer);
      }).to.throw('must be undefined or string');
    });

    it('throws for missing maxSize', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Varchar();
        field.validateField('fieldName', Customer);
      }).to.throw('maxSize required and must be an integer');
    });

    it('throws for maxSize not being a number', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Varchar({maxSize: 'not a number'});
        field.validateField('fieldName', Customer);
      }).to.throw('maxSize required and must be an integer');
    });

    it('throws for maxSize not being > 0', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Varchar({maxSize: 0});
        field.validateField('fieldName', Customer);
      }).to.throw('must be greater than 0');
    });

    it('throws for maxSize having decimal places (10.2323)', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Varchar({maxSize: 10.23232});
        field.validateField('fieldName', Customer);
      }).to.throw('float point decimal');
    });

    it('creates varchar field of size 40 and default value of "default"', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Varchar({maxSize: 40, value: 'default'});
        field.validateField('fieldName', Customer);
      }).to.not.throw();
    });
  }); /* describe Varchar */

  describe('SmallInt Field', function() {
    it(`name is 'SmallInt'`, function() {
      expect(fields.SmallInt.FieldType).to.equal('SmallInt');
    });

    it(`max default size is 2^16 / 2`, function() {
      const maxSize = fields.SmallInt.prototype.getMaxIntSize();
      expect(maxSize).to.equal((1 << 16) / 2);
    });

    it('throws for default value not being number', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.SmallInt({value: "not a number"});
        field.validateField('fieldName', Customer);
      }).to.throw('default value must be an integer');
    });

    it('throws for default for having float decimal places (10.5)', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.SmallInt({value: 10.5});
        field.validateField('fieldName', Customer);
      }).to.throw('float point decimal');
    });

    it('throws for default exceeding max size', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.SmallInt({value: 1 << 16});
        field.validateField('fieldName', Customer);
      }).to.throw('exceeds max limit');
    });

    it('throws for default exceeding -max size', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.SmallInt({value: -(1 << 16)});
        field.validateField('fieldName', Customer);
      }).to.throw('exceeds max limit');
    });

    it('creates SmallInt with default value of 1,000', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.SmallInt({value: 1000});
        field.validateField('fieldName', Customer);
      }).to.not.throw();      
    });

  }); /* describe SmallInt */

  describe('Integer Field', function() {
    it(`name is 'Integer'`, function() {
      expect(fields.Integer.FieldType).to.equal('Integer');
    });

    it(`max default size is 2^32 / 2`, function() {
      const maxSize = fields.Integer.prototype.getMaxIntSize();
      expect(maxSize).to.equal(0x80000000);
    });

    it('throws for default value not being number', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Integer({value: "not a number"});
        field.validateField('fieldName', Customer);
      }).to.throw('default value must be an integer');
    });

    it('throws for default for having float decimal places (10.5)', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Integer({value: 10.5});
        field.validateField('fieldName', Customer);
      }).to.throw('float point decimal');
    });

    it('throws for default exceeding max size', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Integer({value: 3147483648});
        field.validateField('fieldName', Customer);
      }).to.throw('exceeds max limit');
    });

    it('throws for default exceeding -max size', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Integer({value: -3147483648});
        field.validateField('fieldName', Customer);
      }).to.throw('exceeds max limit');
    });

    it('creates Integer with default value of 2147483648', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Integer({value: 2147483648});
        field.validateField('fieldName', Customer);
      }).to.not.throw();      
    });

  }); /* describe Integer */

  describe('BigInt Field', function() {
    it(`name is 'BigIntInteger'`, function() {
      expect(fields.BigInt.FieldType).to.equal('BigInt');
    });

    it(`max default size is 2^32 / 2`, function() {
      const maxSize = fields.BigInt.prototype.getMaxIntSize();
      expect(maxSize).to.equal(0x8000000000000000);
    });

    it('throws for default value not being number', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.BigInt({value: "not a number"});
        field.validateField('fieldName', Customer);
      }).to.throw('default value must be an integer');
    });

    it('throws for default for having float decimal places (10.5)', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.BigInt({value: 10.5});
        field.validateField('fieldName', Customer);
      }).to.throw('float point decimal');
    });

    /* javascript has a 64bit number limit which won't trigger theses tests
    it('throws for default exceeding max size', function() {
      expect(function(){
        const field = fields.BigInt({value: 9223372036854775808});
        field.validateField('fieldName');
      }).to.throw('exceeds max limit');
    });

    it('throws for default exceeding -max size', function() {
      expect(function(){
        const field = fields.BigInt({value: -9223372036854775808});
        field.validateField('fieldName');
      }).to.throw('exceeds max limit');
    });
    */

    it('creates BigInt with default value of 9223372036854776000', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.BigInt({value: 9223372036854776000});
        field.validateField('fieldName', Customer);
      }).to.not.throw();      
    });

  }); /* describe BigInt */

  describe('Boolean Field', function() {
    it(`name is 'Boolean'`, function() {
      expect(fields.Boolean.FieldType).to.equal('Boolean');
    });

    it('throws for default value not being boolean', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Boolean({value: "not a boolean"});
        field.validateField('boolField', Customer);
      }).to.throw('default value must be a boolean');
    });

    it('creates Boolean with default value of false', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.Boolean({value: true});
        field.validateField('boolField', Customer);
      }).to.not.throw();      
    });

  }); /* describe Boolean */

  describe('DateTime Field', function() {
    it(`name is 'DateTime'`, function() {
      expect(fields.DateTime.FieldType).to.equal('DateTime');
    });

    it('throws for default value not being Date instance or function', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.DateTime({value: "Date instance"});
        field.validateField('dateTimeField', Customer);
      }).to.throw('must be Date instance or function');
    });

    it('throws for default value function not returning Date instance', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.DateTime({value: () => {}});
        field.validateField('dateTimeField', Customer);
      }).to.throw('function must return Date instance');
    });

    it('has a default value function returning Date instance', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.DateTime({value: () => {return new Date()}});
        field.validateField('dateTimeField', Customer);
      }).not.to.throw();
    });

    it('has a default value which is a Date instance', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.DateTime({value: new Date()});
        field.validateField('dateTimeField', Customer);
      }).not.to.throw();
    });

    it('throws for having default value and using autoNow option', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.DateTime({value: new Date(), autoNow: true});
        field.validateField('dateTimeField', Customer);
      }).to.throw('choose only one.');
    });

    it('generates correct SQL for using autoNow option', function() {
        const Customer = getCustomerModel();
        const field = fields.DateTime({autoNow: true});
        field.validateField('dateTimeField', Customer);

        expect(field.defaultToSQL()).to.contain('now()');
    });

    it('generates correct SQL for using autoNow option with timezone', function() {
        const Customer = getCustomerModel();
        const field = fields.DateTime({autoNow: true, timeZone: 'CST'});
        field.validateField('dateTimeField', Customer);

        expect(field.defaultToSQL()).to.contain(`now() at time zone 'CST'`);
    });

    it('creates DateTime with CST time zone', function() {
      const Customer = getCustomerModel();
      const field = fields.DateTime({timeZone: 'CST'});
      field.validateField('dateTimeField', Customer);   
      expect(field.options.timeZone).to.equal('CST');
    });

  }); /* describe DateTime */

  describe('ForeignKey Field', function() {
    it(`name is 'ForeignKey'`, function() {
      expect(fields.ForeignKey.FieldType).to.equal('ForeignKey');
    });

    it('throws for being primaryKey', function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.ForeignKey({primaryKey: true});
        field.validateField('fk', Customer);
      }).to.throw('cannot be a primary key');
    });

    it(`throws for 'model' option for being undefined`, function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.ForeignKey();
        field.validateField('fk', Customer);
      }).to.throw(`'model' option is required`);
    });

    it(`throws for 'model' option because its not a DBModel class`, function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.ForeignKey({model: 'not Customer'});
        field.validateField('fk', Customer);
      }).to.throw(`'model' option is required`);
    });

    it(`throws for having invalid 'onDelete' value`, function() {
      expect(function(){
        const Customer = getCustomerModel();
        const onDelete = fields.ForeignKey.onDelete;
        const field = fields.ForeignKey({model: Customer, onDelete: 'not an option'});
        field.validateField('fk', Customer);
      }).to.throw(`invalid onDelete value`);
    });

    it(`adds _id to the dbName of the field`, function() {
      const Customer = getCustomerModel();
      const Test = models.BaseModel.extend('Test', {
        id: fields.AutoSerial({primaryKey: true, nullable: false}),
      });
      const field = fields.ForeignKey({model: Customer});
      field.validateField('customer', Test);
      expect(field.options.dbName).to.equal('customer_id');
    });

    it(`adds reverse name equal to lowercase parent DBModel name`, function() {
      const Customer = getCustomerModel();
      const Test = models.BaseModel.extend('Test', {
        id: fields.AutoSerial({primaryKey: true, nullable: false}),
      });
      const field = fields.ForeignKey({model: Customer});
      field.validateField('customer', Test);
      field.initParentModel();
      expect(field.options.reverse).to.equal('test');
    });

    it(`creates a ForeignKey field with a reference to the Customer model`, function() {
      const Customer = getCustomerModel();

      const onDel = fields.ForeignKey.onDelete;
      const Test = models.BaseModel.extend('Test', {
        id: fields.AutoSerial({primaryKey: true, nullable: false}),
        fk: fields.ForeignKey({model: Customer, onDelete: onDel.SET_NULL, nullable: false})
      });

      let testField = Test._meta.getFieldByName('fk');
      let sql = 'fk_id bigint REFERENCES customer ON DELETE SET NULL NOT NULL';
      expect(testField.toTableSQL()).to.equal(sql);
    });

  }); /* describe ForeignKey */
});

