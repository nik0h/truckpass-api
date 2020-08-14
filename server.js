var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000,
  mongoose = require('mongoose'),
  Client = require('./api/model'), //created model loading here
  bodyParser = require('body-parser');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/TruckpassDB', { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(function(req, res, next) {
    var date = new Date().toJSON();
    console.log('[' + date + '] ' + req.method + ' ' + req.originalUrl);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'tp-parent, tp-auth');
    next();
  });

  var routes = require('./api/route'); //importing route
  routes(app); //register the route

  app.listen(port);

  console.log('Truckpass REST API server started on: ' + port);
});
