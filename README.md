# Truckpass REST API
This is the Express-driven server component of the Truckpass service, for which development was discontinued. Sample data is contained, although possibly with some inconsistencies from development and testing.

You must have MongoDB installed for the server to function. Compass is optional to browse data.

## Usage
1. Start the database with `mongod --dbpath="./data"`
2. Start the server with `npm start`.

A Postman collection has been included: **Truckpass Examples.postman_collection.json**. See **api/route.js** and **api/controller.js** to form your own requests.

Well-formed requests made to the server will print to the console. The project used nodemon for development purposes.
