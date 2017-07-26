/**
 * a script that generates a new test database
 */
const populate_tables = process.argv.indexOf('--populate-tables') == -1 ? false : true;
const TestDataBase = require('../tests/testdb').TestDataBase;

const testDB = TestDataBase({
  database: 'jypsy_orm_test_database', 
  user: 'jypsy', 
  password: 'pass_the_tests'
});

testDB.on('error', function(err) {
  console.log(err);
  process.exit();
});

testDB.on('dbConnected', function(connection) {
  console.log('connected to ' + connection.database);
});

testDB.on('droppedTables', function() {
  console.log('tables dropped');
});

testDB.on('tableCreated', function(result) {
  console.log(`created table ${result.name}`);
});

testDB.on('tablesCreated', function() {
  console.log('done');
  if(!populate_tables) process.exit();

  console.log('populating tables...');
  testDB.populateAllTables().catch(err => {
    console.log(err);
    process.exit();
  });
});

if(populate_tables) {
  testDB.on('tablePopulated', function(result) {
    console.log(`populated ${result.name}`);
  });

  testDB.on('tablesPopulated', function() {
    console.log('done');
    process.exit();
  });
}