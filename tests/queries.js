const expect = require('chai').expect;
const tables = require('./testdb').tables;
const testUtils = require('./util');

const createTestDB = testUtils.createTestDB;
const getRelatedModels = testUtils.getRelatedModels;
const getCustomerModel = testUtils.getCustomerModel;


testUtils.createORMConnection();


describe('QuerySet', function() {
  before(function(done) {
    // drop test db tables and recreate
    createTestDB().then(result => {
      // add data to the customers table
      result.populateCustomers();
      done();
    });
  });

  describe(`valuesList`, function() {
    it('retrieves all customers', function(done) {
      const Customer = getCustomerModel();
      Customer.orm.req().then(result => {
        exp = expect(result).to.have.lengthOf(tables._data.customer.length);
        exp = exp.and.to.deep.include.members(tables._data.customer);
        done();
      });
    });

    it(`retrieves customer 'first' and 'last' columns`, function(done) {
      // get only first and last from columns
      let proofData = tables._data.customer.map(cust => {
        return { first: cust.first, last: cust.last };
      });

      const Customer = getCustomerModel();
      Customer.orm.valuesList('first', 'last').req().then(result => {
        exp = expect(result).to.have.lengthOf(tables._data.customer.length);
        exp = exp.and.to.deep.include.members(proofData);
        done();
      });
    });

    it('')
  }); /* valuesList */

  describe('Query Types', function() {
    it(`throws on valuesList where fields don't exist in model or its relations`, function() {
      const Customer = getCustomerModel();
      expect(function() {
        Customer.orm.valuesList('id', 'first', 'last', 'does_not_exist');
      }).to.throw(`field 'does_not_exist' doesn't exist`);
    });

    it(`throws on valuesList where field doesn't exist in join. lists possible fields`, function() {
      const { Item } = getRelatedModels();
      expect(function() {
        Item.orm.valuesList('is_pizza', 'item_topping.order.customer.is_deleted');
      }).to.throw(`field 'is_deleted' doesn't exist in Customer model. choices are: id, first, last, order`);
    });

    it(`throws on valuesList where not all arguments are strings`, function() {
      const Customer = getCustomerModel();
      expect(function() {
        Customer.orm.valuesList('1', '2', 3, '4', {five: 5});
      }).to.throw(`should be a string`);
    });

    it(`uses valuesList to select foreign key joins from 3 models`, function() {
      const { ItemTopping } = getRelatedModels();
      expect(function() {
        ItemTopping.orm.valuesList('order.customer.first');
      }).not.to.throw(`doesn't exist`);
    });

    it(`uses valuesList to select 'reverse' joins from 3 models`, function() {
      const { Customer } = getRelatedModels();
      expect(function() {
        Customer.orm.valuesList('order.item_topping.item.name');
      }).not.to.throw(`doesn't exist`);
    });   

  }); /* Query Types */

  describe('Queries', function() {
    before(function(done) {
      createTestDB().then(() => done());
    });

    it('inserts a "customer" row', function(done) {
      const Customer = getCustomerModel();
      let insert = Customer.orm.insert({first: 'Apple B', last: 'Saucey'});
      insert.req().then(result => {
        done();
      });
    });

    it('retrieves a customer by filtering for id', function(done) {
      const custObj = { id: "1", first: 'Apple B', last: 'Saucey' };

      const Customer = getCustomerModel();
      customer = Customer.orm.filter({id: 1});
      customer.req().then(result => {
        expect(result).to.have.lengthOf(1).and.to.deep.include(custObj);
        done();
      });
    });

    it('retrieves a customer by filtering for column "first"', function(done) {
      const custObj = { id: "1", first: 'Apple B', last: 'Saucey' };

      const Customer = getCustomerModel();
      customer = Customer.orm.filter({first: 'Apple B'});
      customer.req().then(result => {
        expect(result).to.have.lengthOf(1).and.to.deep.include(custObj);
        done();
      });
    });

    it('filters for specific customer and select only "first" and "last" column', function(done) {
      const custObj = { first: 'Apple B', last: 'Saucey' };

      const Customer = getCustomerModel();
      customer = Customer.orm.filter({id: 1}).valuesList('first', 'last');
      customer.req().then(result => {
        expect(result).to.have.lengthOf(1).and.to.deep.include(custObj);
        done();
      });
    });

    it(`filters for a row that doesn't exist and tries to delete it`, function(done) {
      const Customer = getCustomerModel();
      let del = Customer.orm.filter({first: 'Knot', last: 'Exists'});
      let delPromise = del.delete().req();
      let customer = Customer.orm.filter({id: 1});

      delPromise.then(() => customer.req().then(result => {
        expect(result).lengthOf(1);
        done();
      }));
    });

    it('filters for a row by id and then deletes the row', function(done) {
      const Customer = getCustomerModel();
      let delProm = Customer.orm.filter({id: 1}).delete().req();
      let customer = Customer.orm.filter({id: 1});

      delProm.then(() => customer.req().then(result => {
        expect(result).lengthOf(0);
        done();
      }));
    });

  }); /* Queries */
});
