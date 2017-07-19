const jypsyORM = require('../index');
const TestDataBase = require('../scripts/testdb');
const should = require('chai').should();
const expect = require('chai').expect;

const testDBConfig = {
  database: 'jypsy_orm_test_database', 
  user: 'jypsy', 
  password: 'pass_the_tests'
};


const models = jypsyORM.model.models;
const modelErrors = jypsyORM.model.errors;
const fields = jypsyORM.fields;


// create a connection to the jypsy database for use with the orm
jypsyORM.connect.create(testDBConfig);
jypsyORM.connect.showQueryLog = false;


function createTestDB(done) {
  const testdb = TestDataBase(testDBConfig);
  testdb.on('dbClosed', function(){
    done();
  });
  testdb.on('error', function(err) {
    done(err);
  });
}


function getCustomerModel() {
  return models.BaseModel.extend('Customer', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    first: fields.Text({nullable: false}),
    last: fields.Text(),
  });
}

describe('DBModel', function() {

  describe('Model Validation', function() {

    it('throws for missing model name', function() {
      expect(function(){
        models.BaseModel.extend({
          id: fields.AutoSerial({primaryKey: true, nullable: false})
        });
      }).to.throw('model name not provided for DB Model');
    });

    it('throws for missing model definition', function() {
      expect(function(){
        models.BaseModel.extend('ModelName');
      }).to.throw('does not have definition');
    });

    it(`throws for model definition not being object` , function() {
      expect(function(){
        models.BaseModel.extend('ModelName', 'not an object');
      }).to.throw('does not have definition');
    });

    it(`throws for 'model' prop not being object` , function() {
      expect(function(){
        models.BaseModel.extend('ModelName', {
          intField: fields.BigInt({primaryKey: true, nullable: false}),
          model: 'model prop should be object'
        });
      }).to.throw('property must be object');
    });

    it(`throws for 'model.dbName' prop not being string` , function() {
      expect(function(){
        models.BaseModel.extend('ModelName', {
          intField: fields.BigInt({primaryKey: true, nullable: false}),
          model: {
            dbName: 5
          }
        });
      }).to.throw('dbName must be string');
    });

  });

  describe('Model Field Validation', function() {

    it('throws for missing fields', function() {
      expect(function(){
        models.BaseModel.extend('NoFields', {
          sayHi: function() { console.log('hi') }
        });
      }).to.throw('has no fields');
    });

    it('throws for missing primary key', function() {
      expect(function(){
        models.BaseModel.extend('Test', {
          textField: fields.Text(),
          intField: fields.BigInt(),
        });
      }).to.throw('does not have a primary key');
    });

    it('throws for more than 1 primary key', function() {
      expect(function(){
        models.BaseModel.extend('Test', {
          textField: fields.Text({primaryKey: true, nullable: false}),
          intField: fields.BigInt({primaryKey: true, nullable: false}),
        });
      }).to.throw('contains more than one primary key');
    });    

    it('throws for primary key being null', function() {
      expect(function(){
        models.BaseModel.extend('Test', {
          textField: fields.Text(),
          intField: fields.BigInt(),
          id: fields.AutoSerial({primaryKey: true, nullable: true})
        });
      }).to.throw('cannot be a primary key and be nullable');
    });

    it('throws for while validating the model field', function() {
      expect(function(){
        models.BaseModel.extend('Test', {
          textField: fields.Text("should be an object"),
        });
      }).to.throw('options must be an object');
    });

  });
});


describe('General Field Validations', function() {

  describe('Varchar Field', function() {
    it(`name is 'Varchar'`, function() {
      expect(fields.Varchar.FieldType).to.equal('Varchar');
    });

    it('throws for default value not being string', function() {
      expect(function(){
        const field = fields.Varchar({value: 5}).validateField('fieldName');
      }).to.throw('must be undefined or string');
    });

    it('throws for missing maxSize', function() {
      expect(function(){
        const field = fields.Varchar().validateField('fieldName');
      }).to.throw('maxSize required and must be an integer');
    });

    it('throws for maxSize not being a number', function() {
      expect(function(){
        const field = fields.Varchar({maxSize: 'not a number'}).validateField('fieldName');
      }).to.throw('maxSize required and must be an integer');
    });

    it('throws for maxSize not being > 0', function() {
      expect(function(){
        const field = fields.Varchar({maxSize: 0}).validateField('fieldName');
      }).to.throw('must be greater than 0');
    });

    it('throws for maxSize having decimal places (10.2323)', function() {
      expect(function(){
        const field = fields.Varchar({maxSize: 10.23232}).validateField('fieldName');
      }).to.throw('float point decimal');
    });

    it('creates varchar field of size 40 and default value of "default"', function() {
      expect(function(){
        const field = fields.Varchar({maxSize: 40, value: 'default'});
        field.validateField('fieldName');
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
        const field = fields.SmallInt({value: "not a number"});
        field.validateField('fieldName');
      }).to.throw('default value must be an integer');
    });

    it('throws for default for having float decimal places (10.5)', function() {
      expect(function(){
        const field = fields.SmallInt({value: 10.5});
        field.validateField('fieldName');
      }).to.throw('float point decimal');
    });

    it('throws for default exceeding max size', function() {
      expect(function(){
        const field = fields.SmallInt({value: 1 << 16});
        field.validateField('fieldName');
      }).to.throw('exceeds max limit');
    });

    it('throws for default exceeding -max size', function() {
      expect(function(){
        const field = fields.SmallInt({value: -(1 << 16)});
        field.validateField('fieldName');
      }).to.throw('exceeds max limit');
    });

    it('creates SmallInt with default value of 1,000', function() {
      expect(function(){
        const field = fields.SmallInt({value: 1000});
        field.validateField('fieldName');
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
        const field = fields.Integer({value: "not a number"});
        field.validateField('fieldName');
      }).to.throw('default value must be an integer');
    });

    it('throws for default for having float decimal places (10.5)', function() {
      expect(function(){
        const field = fields.Integer({value: 10.5});
        field.validateField('fieldName');
      }).to.throw('float point decimal');
    });

    it('throws for default exceeding max size', function() {
      expect(function(){
        const field = fields.Integer({value: 3147483648});
        field.validateField('fieldName');
      }).to.throw('exceeds max limit');
    });

    it('throws for default exceeding -max size', function() {
      expect(function(){
        const field = fields.Integer({value: -3147483648});
        field.validateField('fieldName');
      }).to.throw('exceeds max limit');
    });

    it('creates SmallInt with default value of 2147483648', function() {
      expect(function(){
        const field = fields.Integer({value: 2147483648});
        field.validateField('fieldName');
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
        const field = fields.BigInt({value: "not a number"});
        field.validateField('fieldName');
      }).to.throw('default value must be an integer');
    });

    it('throws for default for having float decimal places (10.5)', function() {
      expect(function(){
        const field = fields.BigInt({value: 10.5});
        field.validateField('fieldName');
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
        const field = fields.BigInt({value: 9223372036854776000});
        field.validateField('fieldName');
      }).to.not.throw();      
    });

  }); /* describe BigInt */

  describe('ForeignKey Field', function() {
    it(`name is 'ForeignKey'`, function() {
      expect(fields.ForeignKey.FieldType).to.equal('ForeignKey');
    });

    it('throws for being primaryKey', function() {
      expect(function(){
        const field = fields.ForeignKey({primaryKey: true});
        field.validateField('fk');
      }).to.throw('cannot be a primary key');
    });

    it(`throws for 'model' option for being undefined`, function() {
      expect(function(){
        const field = fields.ForeignKey();
        field.validateField('fk');
      }).to.throw(`'model' option is required`);
    });

    it(`throws for 'model' option because its not a DBModel class`, function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.ForeignKey({model: 'not Customer'});
        field.validateField('fk');
      }).to.throw(`'model' option is required`);
    });

    it(`creates a ForeignKey field with a reference to the Customer model`, function() {
      expect(function(){
        const Customer = getCustomerModel();
        const field = fields.ForeignKey({model: Customer});
        field.validateField('fk');
      }).not.to.throw();
    });

  }); /* describe ForeignKey */
});


describe('queries', function() {
  before(createTestDB);
  it('inserts a "customer" row', function(done) {
    const Customer = getCustomerModel();
    let insert = Customer.orm.insert({first: 'Test_first', last: 'Test_last'});
    insert.req().then(result => {
      done();
    });
  });

  it('gets a customer', function(done) {
    const Customer = getCustomerModel();
    Customer.orm.filter({id: 1}).req().then(result => {
      done();
    });
  });
});
