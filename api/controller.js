'use strict';

var bcrypt = require('bcrypt');
var rword = require('rword');
var mongoose = require('mongoose'),
  Payment = mongoose.model('Payment'),
  User = mongoose.model('User'),
  Receipt = mongoose.model('Receipt'),
  Assign = mongoose.model('Assign'),
  Check = mongoose.model('Check'),
  Client = mongoose.model('Client');
var Grid = require('gridfs-stream'),
  GridFS = Grid(mongoose.connection.db, mongoose.mongo);

exports.addNewClient = function(req, res) {

  //  POST >> Create a new client for usage with the system
  //
  //  Create a new client using master authentication for
  //  rolling out, and returns the client
  //
  //  Headers >> Master auth (unique set)
  //  Requires >> Client name, contract time
  //  Returns >> Client

  var newClient = new Client(req.body);
  newClient.save(function (err, task) {
    if (err)
      res.send(err);
    res.json(task);
  });
};

exports.getClientList = function(req, res) {

  //  GET >> Get list of all registered client companys
  //
  //  This will be used in the app to set the company to
  //  authenticate users to
  //
  //  Returns >> Client name enum

  Client.find({}, function(err, clients) {
    if (err)
      res.send(err);
    var nameArray = [];
    clients.map(client => {
        nameArray.push(client.clientName);
    })
    res.json(nameArray);
  });
};

exports.activateUser = function(req, res) {

  //  POST >> Activate user and store info in device
  //
  //  Will create a hash to be used for authentication,
  //  enabling the user serverside if not already
  //  and failing otherwise
  //
  //  Requires >> Client, user, auth code
  //  Returns >> Client-side hash

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var bool;
    client.users.forEach(function(user) {
      if (user.name == req.body.name) {
        bool = true;
        if (user.activated) {
          res.json({'err':'already activated'});
          return;
        }
        var salt = bcrypt.genSaltSync(10);
        var bank = rword.rword.generate(2);
        var phrase = bank[0][0].toUpperCase() + bank[0].slice(1) + bank[1][0].toUpperCase() + bank[1].slice(1);
        var hash = bcrypt.hashSync(phrase, salt);
        user.set({ auth: hash, activated: true, actDate: Date.now() });
        client.save(function(err) {
          if (err) {
            res.json(err);
            return;
          }
          res.json({ auth: phrase });
          return;
        });
      }
    });
    if (!bool) {
      res.json({'err':'invalid user'});
      return;
    }
  });
};

exports.loginUser = function(req, res) {

  //  POST >> Process login for an activated user
  //
  //  Will return a success or fail state for the
  //  attempt based on matching the hash
  //
  //  Requires >> Parent client, client-stored hash
  //  Returns >> Success state

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var bool;
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.body.auth, user.auth)) {
        bool = true;
        if (user.activated) {
          res.json({'name':user.name,'s':user.isAdmin});
          return;
        }
        res.json({'err':'inactive'});
        return;
      }
    });
    if (!bool) {
      res.json({'err':'invalid'});
      return;
    }
  });
};

exports.testContext = function(req, res) {

  //  GET >> Use user auth to fetch user relevant info
  //
  //  Should fetch entire user document
  //
  //  Headers >> User ID, user hash, parent client
  //  Returns >> User document, sanitized for display and
  //  censoring used check numbers

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      res.json(client.checks);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.getUserInfo = function(req, res) {

  //  GET >> Use user auth to fetch user relevant info
  //
  //  Should fetch entire user document
  //
  //  Headers >> User ID, user hash, parent client
  //  Returns >> User document, sanitized for display and
  //  censoring used check numbers

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (client.users.id(context.id) != null) {
      res.json({ name: client.users.id(context.id).name, checks: client.users.id(context.id).checks, joined: client.users.id(context.id).addDate });
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.setCheckUsage = function(req, res) {

  //  POST >> Mark a user's check allotment as used
  //
  //  Should be used to send correct data to user, and
  //  update admin data (for auditing purposes)
  //
  //  Headers >> User hash
  //  Requires >> Check number
  //  Returns >> Reporting state (follow up with proof)

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (client.users.id(context.id) != null) {
      var bool;
      client.users.id(context.id).checks.forEach(function (check) {
        if (check.code == req.body.code) {
          check.set({ obscure: true });
          bool = true;
          return;
        }
      });
      if (bool) {
        client.checks.forEach(function (check) {
          if (check.code == req.body.code) {
            check.assigned.forEach(function (asgn) {
              if (asgn.name == client.users.id(context.id).name) {
                asgn.set({ marked: true, used: req.body.usage })
                client.save(function(err) {
                  if (err) {
                    res.send(err);
                    return;
                  }
                  res.json({ marked: asgn.marked, used: asgn.used, verified: asgn.verified });
                  return;
                });
              }
            });
            return;
          }
        });
      } else {
        res.json({err:'invalid check'});
        return;
      }
    } else {
      res.json({});
      return;
    }
  });
};

exports.sendUsageProof = function(req, res) {

  //  POST >> Send receipt of check's usage
  //
  //  All cases should be manually checked by an
  //  admin for proper auditing, and saved regardless
  //
  //  Headers >> User auth, check ID
  //  Requires >> Proof (image binary)
  //  Returns >> Success state

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin, name: user.name };
      }
    });
    if (client.users.id(context.id) != null && client.checks.id(req.header('tp-id')) != null) {
      var un;
      var cn;
      var parent = client.checks.id(req.header('tp-id'));
      client.users.id(context.id).checks.forEach(function(check) {
        if (check.code == client.checks.id(req.header('tp-id')).code) {
          cn = check;
        }
      });
      if (cn != null) {
        parent.assigned.forEach(function(user) {
          if (user.name == context.name) {
            un = user;
          }
        });
        if (un != null) {
          var writeStream = GridFS.createWriteStream({
            filename: 'proof_' + Date.now().toString()
          });
          writeStream.on('close', function (file) {
            var receipt = new Receipt;
            receipt.set({
              id: file._id
            });
            cn.set({
              currentProof: receipt._id
            });
            un.receipts.push(receipt);
            client.save(function (err) {
              if (err) {
                res.send(err);
                return;
              }
              res.json({ id: receipt._id });
            });
          });
          req.pipe(writeStream);
        }
      }
    } else {
      res.json({});
      return;
    }
  });
};

exports.getProof = function(req, res) {

  //  POST >> Get receipt of check's usage
  //
  //  Allows user to pull their most recent proof on a check
  //
  //  Headers >> User auth
  //  Requires >> Check ID
  //  Returns >> Success state

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin, name: user.name };
      }
    });
    var ret = false;
    if (client.users.id(context.id) != null) {
      client.users.id(context.id).checks.forEach(function(check) {
        if (check.checkId == req.body.checkId) {
          var parent = client.checks.id(req.body.checkId);
          parent.assigned.forEach(function(user) {
            if (user.name == context.name) {
              if (user.receipts.id(check.currentProof) != null) {
                ret = true;
                var readStream = GridFS.createReadStream({
                  _id: user.receipts.id(check.currentProof).id
                });
                readStream.pipe(res);
              }
            }
          });
        }
      });
      if (!ret) {
        res.json({});
        return;
      }
    } else {
      res.json({});
      return;
    }
  });
};

exports.reportBalanceMismatch = function(req, res) {

  //  POST >> Report a check as unusable
  //
  //  Correlates to a balance mismatch due to a user
  //  improperly reporting, should prompt a manual review
  //
  //  TODO: ADD PUSH NOTIFICATION TO ADMINS
  //
  //  Headers >> User hash
  //  Requires >> Check number
  //  Returns >> Reporting success state

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin, name: user.name };
      }
    });
    var ret = false;
    if (client.users.id(context.id) != null) {
      client.users.id(context.id).checks.forEach(function(check) {
        if (check.checkId == req.body.checkId) {
          ret = true;
          client.checks.id(req.body.checkId).reported = true
          res.json({ r: 0 })
        }
      });
      if (!ret) {
        res.json({ r: 1 });
        return;
      }
    } else {
      res.json({});
      return;
    }
  });
};

exports.getCheckList = function(req, res) {

  //  GET >> Get list of all client's checks
  //
  //  For displaying list to admins to take actions
  //
  //  Headers >> User hash (to check admin), parent client
  //  Returns >> Full client check dictionary

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      res.json(client.checks);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.getCheck = function(req, res) {

  //  GET >> Get list of all client's checks
  //
  //  For displaying list to admins to take actions
  //
  //  Headers >> User hash (to check admin), parent client
  //  Returns >> Full client check dictionary

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      res.json(client.checks.id(req.params.id));
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.addCheck = function(req, res) {

  //  POST >> Add a check to the DB
  //
  //  Will add a check to the full check list
  //  for distribution
  //
  //  Headers >> User hash (admin), parent client
  //  Requires >> Check number, full balance, type
  //  Returns >> Updated check list

  var newCheck = new Check(req.body);
  newCheck.currentBal = newCheck.originalBal;
  newCheck.availableBal = newCheck.originalBal;
  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      client.checks.push(newCheck);
      client.save(function(err) {
        if (err) {
          res.send(err);
          return;
        }
        res.json(client.checks);
        return;
      });
    } else {
      res.json({});
      return;
    }
  });
};

exports.removeCheck = function(req, res) {

  //  POST >> Remove a check from the debug
  //
  //  Removes the check and its associated info
  //  from the database entirely (useful for false
  //  or mistyped numbers)
  //
  //  Headers >> User hash (admin), parent client
  //  Requires >> Check ID
  //  Returns >> Updated check list

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      if (client.checks.id(req.body.id) != null) {
        client.checks.id(req.body.id).remove()
        client.save(function(err) {
          if (err) {
            res.send(err);
            return;
          }
        });
      }
      res.json(client.checks);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.getUserList = function(req, res) {

  //  GET >> Get list of all client's users
  //
  //  For displaying list to admins to take actions
  //
  //  Headers >> User hash (to check admin), parent client
  //  Returns >> Full client user array

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      res.json(client.users);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.getUser = function(req, res) {

  //  GET >> Get info for user
  //
  //  Used to render unique user page
  //
  //  Headers >> User hash (to check admin), parent client
  //  Requires >> User ID (param)
  //  Returns >> User info dict

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      res.json(client.users.id(req.params.id));
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.getUserHistory = function(req, res) {

  //  GET >> Get list of all client's users
  //
  //  For displaying list to admins to take actions
  //
  //  Headers >> User hash (to check admin), parent client
  //  Returns >> Full client user array

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      var hist = [];
      var name = client.users.id(req.params.id).name;
      client.checks.forEach(function(check) {
        check.assigned.forEach(function(assign) {
          if (assign.name == name && assign.marked) {
            hist.push({ id: assign._id, type: check.type, code: check.code, balance: assign.balance });
          }
        });
      });
      res.json(hist);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.addUser = function(req, res) {

  //  POST >> Add a user to the DB
  //
  //  Will add a user to the full user list
  //  for distribution
  //
  //  Headers >> User hash (admin), parent client
  //  Requires >> User name
  //  Returns >> First-time auth info (TODO), updated user array

  var newUser = new User(req.body);
  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      client.users.push(newUser);
      client.save(function(err) {
        if (err) {
          res.send(err);
          return;
        }
        res.json(client.users);
        return;
      });
    } else {
      res.json({});
      return;
    }
  });
};

exports.removeUser = function(req, res) {

  //  POST >> Remove a check from the debug
  //
  //  Removes the user from the database and
  //  disables usage and states
  //
  //  Headers >> User hash (admin), parent client
  //  Requires >> User ID
  //  Returns >> Updated user array

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      if (client.users.id(req.body.id) != null) {
        client.users.id(req.body.id).remove()
        client.save(function(err) {
          if (err) {
            res.send(err);
            return;
          }
        });
      }
      res.json(client.users);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.setUserLock = function(req, res) {

  //  POST >> Temporarily locks or unlocks user
  //
  //  Should retain login details on client to continue
  //  seamlessly logging in after unlocking
  //
  //  Headers >> User hash (admin), parent client
  //  Requires >> User ID, lock state
  //  Returns >> Updated user list

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      if (client.users.id(req.body.id) != null) {
        client.users.id(req.body.id).activated = req.body.state;
        client.save(function(err) {
          if (err) {
            res.send(err);
            return;
          }
        });
      }
      res.json(client.users);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.addCheckUser = function(req, res) {

  //  POST >> Add a check to a user
  //
  //  Adds a check to a user to display it on
  //  their interface
  //
  //  Headers >> User hash (admin)
  //  Requires >> Check ID, recipient user ID, alloted
  //  balance
  //  Returns >> Updated check info

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
        return;
      }
    })
    if (context.act && context.adm) {
      if (client.checks.id(req.body.checkId) != null) {
        if (client.users.id(req.body.userId) != null) {
          var assign = new Assign;
          assign.set({
            name: client.users.id(req.body.userId).name,
            balance: req.body.balance
          });

          var payment = new Payment;
          payment.set({
            type: client.checks.id(req.body.checkId).type,
            balance: req.body.balance,
            code: client.checks.id(req.body.checkId).code,
            checkId: req.body.checkId
          });

          client.checks.id(req.body.checkId).assigned.push(assign);
          client.users.id(req.body.userId).checks.push(payment);

          var check = client.checks.id(req.body.checkId);
          check.set('availableBal', parseFloat(check.availableBal.toString() - req.body.balance));

          client.save(function(err) {
            if (err) {
              res.json(err);
              return;
            }
            res.json(client.checks.id(req.body.checkId));
            return;
          });
        } else {
          res.json({err:'invalid user'});
          return;
        }
      } else {
        res.json({err:'invalid check'});
        return;
      }
    } else {
      res.json({});
      return;
    }
  });
};

exports.removeCheckUser = function(req, res) {

  //  POST >> Removes a check from a user
  //
  //  Removes a check from a user to no longer
  //  display it on their interface
  //
  //  Headers >> User hash (admin)
  //  Requires >> Check, recipient user hash/name
  //  Returns >> Success state

  var new_task = new Task(req.body);
  new_task.save(function(err, task) {
    if (err)
      res.send(err);
    res.json(task);
  });
};

exports.setAdmin = function(req, res) {

  //  POST >> Set a user's admin privileges
  //
  //  Gives/removes a user admin privileges, only issuable
  //  by client's first user (top-level admin)
  //
  //  Headers >> User hash (admin), parent client
  //  Requires >> User ID, admin state
  //  Returns >> Updated user array

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      if (client.users.id(req.body.id) != null) {
        client.users.id(req.body.id).isAdmin = req.body.state;
        client.save(function(err) {
          if (err) {
            res.send(err);
            return;
          }
        });
      }
      res.json(client.users);
    } else {
      res.json({});
      return;
    }
  });
};

exports.retrieveProofs = function(req, res) {

  //  GET >> Retrive list of all proofs to review with images
  //
  //  Array should be returned to be properly listed,
  //  along with decoding base64 images
  //
  //  Headers >> User hash (admin)
  //  Returns >> Full proof dictionary

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      var proofs = [];
      client.checks.forEach(function(check) {
        check.assigned.forEach(function(assn) {
          assn.receipts.forEach(function(receipt) {
            var dummy = JSON.parse(JSON.stringify(receipt));
            dummy.assnId = assn._id;
            dummy.checkId = check._id;
            proofs.push(dummy);
          });
        });
      });
      res.json(proofs);
      return;
    } else {
      res.json({});
      return;
    }
  });
};

exports.validateProof = function(req, res) {

  //  POST >> Marks a proof as valid or invalid
  //
  //  Will be used to either verify for auditing or
  //  deny to request a new proof from the user
  //
  //  Headers >> User hash (admin)
  //  Requires >> Proof ID
  //  Returns >> Success state

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      var ret = false;
      client.checks.forEach(function(check) {
        check.assigned.forEach(function(assn) {
          if (assn.receipts.id(req.body.id) != null) {
            ret = true;
            assn.receipts.id(req.body.id).marked = true;
            assn.receipts.id(req.body.id).verified = req.body.state;
            client.save(err => {
              if (err) {
                res.json(err);
                return;
              }
              res.json(assn.receipts.id(req.body.id));
              return;
            });
          }
        });
      });
      if (!ret) {
        res.json({});
        return;
      }
    } else {
      res.json({});
      return;
    }
  });
};

exports.adminProof = function(req, res) {

  //  GET >> Pull any proof's image
  //
  //  Admin access to all proofs, pull image directly
  //
  //  Headers >> User auth (to check admin), parent client
  //  Requires >> Proof ID (params)
  //  Returns >> Image

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin, name: user.name };
      }
    });
    var ret = false;
    if (context.act && context.adm) {
      var readStream = GridFS.createReadStream({
        _id: req.params.id
      });
      readStream.pipe(res);
    } else {
      res.json({});
      return;
    }
  });
};

exports.getReports = function(req, res) {

  //  GET >> Get all reported checks
  //
  //  Viewable in audit section for admins
  //
  //  Headers >> User hash (to check admin), parent client
  //  Returns >> Full list of reported assignments

  Client.findOne({ clientName: req.header('tp-parent') }, function (err, client) {
    if (err) {
      res.send(err);
      return;
    }
    var context = {};
    client.users.forEach(function(user) {
      if (user.auth && bcrypt.compareSync(req.header('tp-auth'), user.auth)) {
        context = { id: user._id, act: user.activated, adm: user.isAdmin };
      }
    })
    if (context.act && context.adm) {
      var rep = [];
      client.checks.forEach(function(check) {
        check.assigned.forEach(function(assign) {
          if (assign.reported) {
            hist.push(assign);
          }
        });
      });
      res.json(rep);
      return;
    } else {
      res.json({});
      return;
    }
  });
};
