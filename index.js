const connect = require('./src/connect'); 
const models = require('./src/model');
const fields = require('./src/fields');


module.exports = {
  models,
  fields,
  dbConnect: connect.create
};
