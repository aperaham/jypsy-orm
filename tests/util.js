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


utils.getItemTopping = function(ItemClass, ToppingClass, OrderClass) {
  return models.BaseModel.extend('ItemTopping', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    item: fields.ForeignKey({model: ItemClass, nullable: false}),
    item_topping: fields.ForeignKey({model: ToppingClass}),
    order: fields.ForeignKey({model: OrderClass, nullable: false}),

    model: {
      dbName: 'item_topping'
    }
  });
};


utils.getRelatedModels = function() {
  const Customer = getCustomerModel();
  const Order = getOrderModel(Customer);
  const Item = getItemModel();
  const Topping = getToppingModel();
  const ItemTopping = getItemTopping(Item, Topping, Order);
  return { Customer, Order,  Item, Topping, ItemTopping };
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
  testdb.on('dbClosed', function(){
    done();
  });
  testdb.on('error', function(err) {
    done(err);
  });
};



module.exports = utils;
