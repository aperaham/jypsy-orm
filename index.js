const connect = require('./src/connect'); 
const model = require('./src/model');
const fields = require('./src/fields');

const test = function() {

  const { getRelatedModels, testDBConfig } = require('./tests/util.js');
  const { OrderItem, Order, Customer } = getRelatedModels();

  connect.create(testDBConfig);

  //Order.orm.values('order_item.item.name');

  /*
  let steve = Customer.orm.filter({order__is_paid: false});

  let orders = Order.orm.valuesList(
    'order_item.item.name', 'customer.first', 'customer.last', 'id', 'customer_id'
  );

  orders = orders.filter({customer: steve, is_paid: false});

  orders.req().then(d => {
    console.log(d);
  });
  */

  // let custs = Customer.orm.valuesList('order__customer__order__is_paid');
  let custs = Customer.orm.valuesList('first');
  custs = custs.filter({'order__customer.first': 'Steve'});
  custs.req().then(d => {
    console.log(d);
  });

};

//setTimeout(test, 0);

module.exports = {
  model,
  fields,
  connect
};
