const jypsyORM = require('../index');


describe('DBModel', function() {
  describe('queries', function() {
    if('gets a query', function() {
      createTestDatabase();
      jypsyORM.models.Name.orm.then(result =>{
        console.log(result);
      });
    });
  });
});
