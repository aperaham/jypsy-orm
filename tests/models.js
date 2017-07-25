const expect = require('chai').expect;
const jypsyORM = require('../index');

const models = jypsyORM.model.models;
const fields = jypsyORM.fields;


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

  }); /* Model Validation */

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

    it('throws while validating the model field', function() {
      expect(function(){
        models.BaseModel.extend('Test', {
          textField: fields.Text("should be an object"),
        });
      }).to.throw('options must be an object');
    });

    it('throws for reverse name conflict', function() {
      expect(function() {
        const Parent = models.BaseModel.extend('Parent', {
          id: fields.AutoSerial({primaryKey: true, nullable: false})
        });

        const Child1 = models.BaseModel.extend('Child1', {
          id: fields.AutoSerial({primaryKey: true, nullable: false}),
          parent: fields.ForeignKey({model: Parent, reverse: 'child'})
        });

        const Child2 = models.BaseModel.extend('Child2', {
          id: fields.AutoSerial({primaryKey: true, nullable: false}),
          parent: fields.ForeignKey({model: Parent, reverse: 'child'})
        });
      }).to.throw(`reverse name 'child' already exists on model 'Parent' (from Child1 Model)`);
    });
  }); /* Model Field Validation */
});

