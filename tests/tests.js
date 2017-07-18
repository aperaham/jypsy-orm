const jypsyORM = require('../index');
const TestDataBase = require('../scripts/testdb');


const testDBConfig = {
  database: 'jypsy_orm_test_database', 
  user: 'jypsy', 
  password: 'pass_the_tests'
};


const models = jypsyORM.models;
const fields = jypsyORM.fields;


// create a connection to the jypsy database for use with the orm
jypsyORM.dbConnect.create(testDBConfig);
jypsyORM.dbConnect.showQueryLog = true;


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

  before(createTestDB);

  describe('queries', function() {

    it('inserts a "customer" row', function(done) {
      const Customer = getCustomerModel();
      let insert = Customer.orm.insert({first: 'Test_first', last: 'Test_last'});
      insert.req().then(result => {
        console.log(result);
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

});
