const expect = require('chai').expect;
const tables = require('./testdb').tables;
const testUtils = require('./util');
const _query = require('../index').connect.query;


const createTestDB = testUtils.createTestDB;
const getRelatedModels = testUtils.getRelatedModels;
const getCustomerModel = testUtils.getCustomerModel;


testUtils.createORMConnection();


describe('QuerySet', function() {
  describe(`valuesList`, function() {

    before(function(done) {
      // drop test db tables and recreate
      createTestDB().then(result => {
        // add data to the customers table
        result.populateAllTables().then(done);
      });
    });

    it('retrieves all customers', function() {
      const Customer = getCustomerModel();
      return Customer.orm.req().then(result => {
        let exp = expect(result).to.have.lengthOf(tables._data.customer.length);
        exp = exp.and.to.deep.include.members(tables._data.customer);
      });
    });

    it(`retrieves customer 'first' and 'last' columns`, function() {
      // get only first and last from columns
      let proofData = tables._data.customer.map(cust => {
        return { first: cust.first, last: cust.last };
      });

      const Customer = getCustomerModel();
      return Customer.orm.valuesList('first', 'last').req().then(result => {
        let exp = expect(result).to.have.lengthOf(proofData.length);
        exp = exp.and.to.deep.include.members(proofData);
      });
    });

    it(`reverse join to 'order' from 'customer' to retrieve customer ids`, function() {
      const proofData = tables._data.order.map(ord => {
        return {is_paid: ord.is_paid}
      });

      const { Customer } = getRelatedModels();
      const query = Customer.orm.valuesList('order.is_paid');
      return query.req().then(result => {
        let exp = expect(result).to.have.lengthOf(proofData.length);
        exp = exp.and.to.deep.include.members(proofData);
      });
    });

    it(`throws on valuesList where fields don't exist in model or its relations`, function() {
      const Customer = getCustomerModel();
      expect(function() {
        Customer.orm.valuesList('id', 'first', 'last', 'does_not_exist');
      }).to.throw(`field 'does_not_exist' doesn't exist`);
    });

    it(`throws where field doesn't exist in join. lists possible fields`, function() {
      const { Item } = getRelatedModels();
      expect(function() {
        Item.orm.valuesList('is_pizza', 'order_item.order.customer.doesnt_exist');
      }).to.throw(`field 'doesnt_exist' doesn't exist in Customer model. choices are: id, first, last, order`);
    });

    it(`throws where not all arguments are strings`, function() {
      const Customer = getCustomerModel();
      expect(function() {
        Customer.orm.valuesList('1', '2', 3, '4', {five: 5});
      }).to.throw(`should be a string`);
    });

    it(`selects foreign key joins from 3 models`, function() {
      const { ItemTopping } = getRelatedModels();

      const proofQuerySQL = `
        SELECT customer.first from item_topping
        JOIN order_item ON order_item.id = item_topping.order_item_id
        JOIN "order" ord ON ord.id = order_item.order_id
        JOIN customer ON customer.id = ord.customer_id;
      `;
      let queryPromise = _query(proofQuerySQL);

      return queryPromise.then(proof => {
        const proofData = proof.rows;

        let ormQuery;
        expect(function() {
          ormQuery = ItemTopping.orm.valuesList('order_item.order.customer.first');
        }).not.to.throw(`doesn't exist`);

        return ormQuery.req().then(result => {
          let exp = expect(result).to.have.lengthOf(proofData.length);
          exp = exp.and.to.deep.include.members(proofData);
        });
      });
    });

    it(`selects 'reverse' joins from 3 models`, function() {
      const { Customer } = getRelatedModels();

      const proofQuerySQL = `
        SELECT item.name FROM customer
        JOIN "order" as ord ON ord.customer_id = customer.id
        JOIN order_item ON order_item.order_id = ord.id
        JOIN item ON item.id = order_item.item_id;
      `;
      let queryPromise = _query(proofQuerySQL);

      return queryPromise.then(proof => {
        const proofData = proof.rows;
        let ormQuery;
        expect(function() {
          ormQuery = Customer.orm.valuesList('order.order_item.item.name');
        }).not.to.throw(`doesn't exist`);

        return ormQuery.req().then(result => {
          let exp = expect(result).to.have.lengthOf(proofData.length);
          exp = exp.and.to.deep.include.members(proofData);
        });
      });
    });   

  }); /* valuesList */

  describe('orderBy', function() {

    before(function(done) {
      // drop test db tables and recreate
      createTestDB().then(result => {
        // add data to the customers table
        result.populateAllTables().then(done);
      });
    });

    it('selects from customer table and desc orders id field', function() {
      const Customer = getCustomerModel();

      const proof = tables._data.customer.slice().sort((a, b) => {
        return a.id < b.id;
      });

      const customer = Customer.orm.orderBy('-id');
      return customer.req().then(r => {
        expect(r).to.deep.eq(proof);
      }); 
    });

    it('selects from customer table and desc orders last field', function() {
      const Customer = getCustomerModel();

      const proof = tables._data.customer.slice().sort((a, b) => {
        return a.last < b.last;
      });

      const customer = Customer.orm.orderBy('-last');
      return customer.req().then(r => {
        expect(r).to.deep.eq(proof);
      }); 
    });

    it('selects from order table and orders on desc customer last name', function() {
      const { Customer, Order } = getRelatedModels();

      let order = Order.orm.orderBy('-customer.last').req();

      const proofQuerySQL = `
        SELECT "order".* FROM "order"
        JOIN customer ON customer.id = "order".customer_id
        ORDER BY customer.last DESC
      `;
      let queryPromise = _query(proofQuerySQL);

      return queryPromise.then(q => {
        const proof = q.rows;
        return order.then(r => {
          expect(r).to.deep.eq(proof);
        });
      });

    });

    it('selects from item table and orders on customer last name', function() {
      const { Item, OrderItem, Order, Customer } = getRelatedModels();

      let items = Item.orm.orderBy('order_item.order.customer.last').req();

      const proofQuerySQL = `
        SELECT item.* FROM item
        JOIN order_item oi ON oi.item_id = item.id
        JOIN "order" ord ON ord.id = oi.order_id
        JOIN customer ON customer.id = ord.customer_id
        ORDER BY customer.last
      `;
      let queryPromise = _query(proofQuerySQL);

      return queryPromise.then(q => {
        const proof = q.rows;
        return items.then(r => {
          expect(r).to.deep.eq(proof);
        });
      });

    });

  });

  describe('filter', function() {

    before(function(done) {
      // drop test db tables and recreate
      createTestDB().then(result => {
        // add data to the customers table
        result.populateAllTables().then(done);
      });
    });

    it('retrieves a customer by id', function() {
      const proofData = tables._data.customer[0];

      const Customer = getCustomerModel();
      const query = Customer.orm.filter({id: proofData.id});
      return query.req().then(result => {
        expect(result).to.have.lengthOf(1).and.to.deep.include(proofData);
      });
    });

    it('retrieves a customer by filtering for column "first"', function() {
      const proofData = tables._data.customer[1];

      const Customer = getCustomerModel();
      const query = Customer.orm.filter({first: proofData.first});
      return query.req().then(result => {
        expect(result).to.have.lengthOf(1).and.to.deep.include(proofData);
      });
    });

    it('filters for specific customer and select only "first" and "last" column', function() {
      const customer = tables._data.customer[0];
      const proofData = {first: customer.first, last: customer.last};

      const Customer = getCustomerModel();
      const query = Customer.orm.filter({id: customer.id}).valuesList('first', 'last');
      return query.req().then(result => {
        expect(result).to.have.lengthOf(1).and.to.deep.include(proofData);
      });
    });

    it('filters for specific customer through join on order table', function() {
      const { Order } = getRelatedModels();

      const proofQuerySQL = `
        SELECT ord.* FROM "order" ord
        JOIN customer ON customer.id = ord.customer_id
        WHERE customer.first = 'Steve';
      `;
      let queryPromise = _query(proofQuerySQL);

      return queryPromise.then(proof => {
        const proofData = proof.rows;

        const orders = Order.orm.filter({customer__first: 'Steve'});

        return orders.req().then(result => {
          let exp = expect(result).to.have.lengthOf(result.length);
          exp = exp.and.to.deep.include.members(proofData);
        });
      });
    });

    it('subqueries all order_items from a customer: order_item(order(customer))', function() {
      const { Customer, Order, OrderItem } = getRelatedModels();
      const customer = tables._data.customer[0];

      const proofQuerySQL = `
        SELECT order_item.*
        FROM order_item
        WHERE order_id IN (
            SELECT id FROM "order" as ord
            WHERE customer_id IN (
                SELECT id from customer
                WHERE id = $1
            )
        );`
      let proofData; 
      let promise = _query(proofQuerySQL, [customer.id]).then(result => {
        proofData = result.rows;
      });
      
      let customerQuery = Customer.orm.filter({id: customer.id}).valuesList('id');
      let orderQuery = Order.orm.filter({customer: customerQuery}).valuesList('id');
      let orderItemQuery = OrderItem.orm.filter({order: orderQuery});

      return promise = promise.then(() => orderItemQuery.req().then(result => {
        let exp = expect(result).to.have.lengthOf(proofData.length)
        exp = exp.and.to.deep.include.members(proofData);
      }));
    });

    it('subqueries lazy-style from order table by customer table for Steve', function() {
      const { Customer, Order } = getRelatedModels();

      const proofQuerySQL = `
        SELECT ord.* FROM "order" ord
        WHERE ord.customer_id IN (
          SELECT id FROM customer
          WHERE customer.first = 'Steve'
        );
      `;
      let queryPromise = _query(proofQuerySQL);

      return queryPromise.then(proof => {
        const proofData = proof.rows;

        const steves = Customer.orm.filter({first: 'Steve'});
        return Order.orm.filter({customer: steves}).req().then(result => {
          let exp = expect(result).to.have.lengthOf(result.length);
          exp = exp.and.to.deep.include.members(proofData);
        });
      });
    });
  });

  describe('delete', function() {

    beforeEach(function(done) {
      // drop test db tables and recreate
      createTestDB().then(result => {
        // add data to the customers table
        result.populateAllTables().then(done);
      });
    });

    it(`filters for a row that doesn't exist and tries to delete it`, function() {
      const Customer = getCustomerModel();

      let queryEmpty = Customer.orm.filter({first: 'Knot', last: 'Exists'});
      return queryEmpty.delete().req().then(result => {
        expect(result).to.equal(0);
      });
    });

    it('filters for a row by id and then deletes the row', function() {
      const proofData = tables._data.customer[3];
      const Customer = getCustomerModel();
      
      let query = Customer.orm.filter({id: proofData.id}).delete().req();
      query = query.then(result => {
        // results should return number of deleted items
        expect(result).to.equal(1)
      });

      let customer = Customer.orm.filter({id: proofData.id});
      return query.then(() => customer.req().then(result => {
        expect(result).lengthOf(0);
      }));
    });

    it(`deletes all rows in the customer table`, function() {
      const Customer = getCustomerModel();
      
      let CustomerCount;
      let query = Customer.orm.req().then(result => {
        // 1.) get number of customers
        CustomerCount = result.length;
      });

      const delQuery = Customer.orm.delete();
      query = query.then(() => delQuery.req().then(deleted => {
        // 2.) delete customer 
        expect(deleted).to.equal(CustomerCount);        
      }));

      return query.then(() => Customer.orm.req().then(result => {
        // 3.) make sure customers have been deleted
        expect(result).to.have.lengthOf(0);
      }));
    });

    it(`deletes customers matching backward relation filter`, function() {
      const { Customer, Order } = getRelatedModels();

      // delete only customers that haven't made orders
      let noOrders = Customer.orm.filter({order__id: null}).delete();
      return noOrders.req().then(result => {
        expect(result).to.equal(2);
      });
    });
  });

  describe('distinct', function() {
    before(function(done) {
      // drop test db tables and recreate
      createTestDB().then(result => {
        // add data to the customers table
        result.populateAllTables().then(done);
      });
    });

    it('join all distinct customers by order table', function() {
      const { Customer, Order } = getRelatedModels();

      const proofQuerySQL = `
        SELECT DISTINCT ON ("order".customer_id) customer.* FROM customer
        JOIN "order" ON "order".customer_id = customer.id
        ORDER BY "order".customer_id;
      `;

      let proofData; 
      let promise = _query(proofQuerySQL).then(result => {
        proofData = result.rows;
      });
      
      const qField = 'order.customer_id';
      let customerQuery = Customer.orm.distinct(qField).orderBy(qField);

      return promise = promise.then(() => customerQuery.req().then(result => {
        let exp = expect(result).to.have.lengthOf(proofData.length)
        exp = exp.and.to.deep.include.members(proofData);
      }));
    });

    it('left join all distinct customers by order table', function() {
      const { Customer, Order } = getRelatedModels();

      const proofQuerySQL = `
        SELECT DISTINCT ON ("order"."customer_id") customer.* FROM "order"
        LEFT JOIN customer ON "order"."customer_id" = customer.id
        ORDER BY "order"."customer_id";
      `;

      let proofData; 
      let promise = _query(proofQuerySQL).then(result => {
        proofData = result.rows;
      });
      
      let customerQuery = Order.orm
        .valuesList('customer__id', 'customer__first', 'customer__last')
        .distinct('customer_id')
        .orderBy('customer_id');

      return promise = promise.then(() => customerQuery.req().then(result => {
        let exp = expect(result).to.have.lengthOf(proofData.length)
        exp = exp.and.to.deep.include.members(proofData);
      }));
    });
  });
});
