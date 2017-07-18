/**
 * a script that generates a new test database
 */

const TestDataBase = require('./testdb')

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

testDB.on('tablesCreated', function() {
  console.log('tables created');
});

testDB.on('dbClosed', function(connection) {
  console.log('disconnected from database');
});