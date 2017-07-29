/* 
** shared utils for testing 
*/
const models = require('../index').model.models;
const TestDataBase = require('./testdb').TestDataBase;
const jypsyORM = require('../index');

const fields = jypsyORM.fields;


const utils = {};
utils.getCustomerModel = function() {
  return models.BaseModel.extend('Customer', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    first: fields.Text({nullable: false}),
    last: fields.Text(),
  });
};


utils.getOrderModel = function(CustomerClass) {
  return models.BaseModel.extend('Order', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    customer: fields.ForeignKey({model: CustomerClass, nullable: false}),
    is_paid: fields.Boolean({value: false, nullable: false})
  });
};


utils.getItemModel = function() {
  return models.BaseModel.extend('Item', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    is_pizza: fields.Boolean({nullable: false}),
    name: fields.Text({nullable: false}),
    price_cents: fields.Integer({nullable: false})
  });
};


utils.getToppingModel = function() {
  return models.BaseModel.extend('Topping', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    name: fields.Text({nullable: false}),
    price_cents: fields.Integer({nullable: false}),
  });
};


utils.getOrderItemModel = function(OrderClass, ItemClass) {
  return models.BaseModel.extend('OrderItem', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    order: fields.ForeignKey({model: OrderClass, nullable: false}),
    item: fields.ForeignKey({model: ItemClass, nullable: false}),

    model: {
      dbName: 'order_item'
    }
  });
};


utils.getItemTopping = function(OrderItemClass, ToppingClass) {
  return models.BaseModel.extend('ItemTopping', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    order_item: fields.ForeignKey({model: OrderItemClass, nullable: false}),
    topping: fields.ForeignKey({model: ToppingClass}),

    model: {
      dbName: 'item_topping'
    }
  });
};


utils.getRelatedModels = function() {
  const Customer = utils.getCustomerModel();
  const Order = utils.getOrderModel(Customer);
  const Item = utils.getItemModel();
  const Topping = utils.getToppingModel();
  const OrderItem = utils.getOrderItemModel(Order, Item);
  const ItemTopping = utils.getItemTopping(OrderItem, Topping);
  return { Customer, Order,  Item, Topping, OrderItem, ItemTopping };
};


utils.testDBConfig = {
  database: 'jypsy_orm_test_database', 
  user: 'jypsy', 
  password: 'pass_the_tests'
};


utils.createORMConnection = function() {
  jypsyORM.connect.create(utils.testDBConfig);
}


utils.createTestDB = function(done) {
  const testdb = TestDataBase(utils.testDBConfig);
  let promise = new Promise((res, rej) => {
    testdb.on('tablesCreated', function(db){
      res(db);
    });
    testdb.on('error', function(err) {
      rej();
    });
  });
  return promise;
};


module.exports = utils;
