'use strict';

module.exports = function(app) {
  var func = require('./controller');

  app.route('/clients')
    .get(func.getClientList) //
    .post(func.addNewClient); //

  app.route('/activate')
    .post(func.activateUser); // activates users and issues salt

  app.route('/debug')
    .post(func.testContext); // activates users and issues salt

  app.route('/login')
    .post(func.loginUser); // checks for activation and hash to match up with a user

  app.route('/userInfo')
    .get(func.getUserInfo); // authed

  app.route('/use')
    .post(func.setCheckUsage); // sets obsure , marked , used

  app.route('/sendReceipt')
    .post(func.sendUsageProof); // requires check id, user auth, file sent binary TODO: ext. validation

  app.route('/getReceipt')
    .post(func.getProof); // gets proof given check number and proof id

  app.route('/report')
    .post(func.reportBalanceMismatch); // currently sets reported to true on check
                                      // should be supplemented with sanitization from user records while under review,
                                      // and pinging all admins via push to prompt review in addition to being used for
                                      // pulling all cases needing review

  app.route('/admin/checks')
    .get(func.getCheckList) // authed
    .post(func.addCheck) // authed
    .delete(func.removeCheck); // authed

  app.route('/admin/checks/:id')
    .get(func.getCheck); //

  app.route('/admin/users')
    .get(func.getUserList) // authed
    .post(func.addUser) // authed
    .delete(func.removeUser); // authed

  app.route('/admin/users/:id')
    .get(func.getUser); //

  app.route('/admin/users/:id/history')
    .get(func.getUserHistory); //

  app.route('/admin/userLock')
    .post(func.setUserLock); // authed

  app.route('/admin/checkUser')
    .post(func.addCheckUser) // authed
    .delete(func.removeCheckUser);

  app.route('/admin/promote')
    .post(func.setAdmin); // authed

  app.route('/admin/proofs')
    .get(func.retrieveProofs) // returns all proofs under client with check and assignment ids
    .post(func.validateProof); // should be used to display in app, sets marked and verified to filter proofs

  app.route('/admin/proofs/:id')
    .get(func.adminProof);

  app.route('/admin/reports')
    .get(func.getReports);

  // app.route('/tasks/:taskId')
  //   .get(func.read_a_task)
  //   .put(func.update_a_task)
  //   .delete(func.delete_a_task);
};
