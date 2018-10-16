/**

@module SERO:accounts
*/

/**
The accounts collection, with some SERO additions.

@class SEROAccounts
@constructor
*/
var collection = new Mongo.Collection("sero_accounts", {
  connection: null
});
SEROAccounts = _.clone(collection);
SEROAccounts._collection = collection;

if (typeof PersistentMinimongo !== "undefined")
  new PersistentMinimongo(SEROAccounts._collection);

/**
Updates the accounts balances, by watching for new blocks and checking the balance.

@method _watchBalance
*/
SEROAccounts._watchBalance = function() {
  var _this = this;

  if (this.blockSubscription) {
    this.blockSubscription.unsubscribe();
  }

  // UPDATE SIMPLE ACCOUNTS balance on each new block
  this.blockSubscription = web3.ser
    .subscribe("newBlockHeaders")
    .on("data", function() {
      _this._updateBalance();
    });
};

/**
Updates the accounts balances.

@method _updateBalance
*/
SEROAccounts._updateBalance = function() {
  var _this = this;

  _.each(SEROAccounts.find({}).fetch(), function(account) {
    web3.ser.getBalance(account.address, function(err, res) {
      if (!err) {
        if (res.toFixed) {
          res = res.toFixed();
        }

        SEROAccounts.update(account._id, {
          $set: {
            balance: res
          }
        });
      }
    });
  });
};

/**
Updates the accounts list,
if its finds a difference between the accounts in the collection and the accounts in the accounts array.

@method _addAccounts
*/
SEROAccounts._addAccounts = function() {
  var _this = this;

  // UPDATE normal accounts on start
  web3.ser.getAccounts(function(e, accounts) {
    if (!e) {
      var visibleAccounts = _.pluck(SEROAccounts.find().fetch(), "address");

      if (
        !_.isEmpty(accounts) &&
        _.difference(accounts, visibleAccounts).length === 0 &&
        _.difference(visibleAccounts, accounts).length === 0
      )
        return;

      var localAccounts = SEROAccounts.findAll().fetch();

      // if the accounts are different, update the local ones
      _.each(localAccounts, function(account) {
        // needs to have the balance
        if (!account.balance) return;

        // set status deactivated, if it seem to be gone
        if (!_.contains(accounts, account.address)) {
          SEROAccounts.updateAll(account._id, {
            $set: {
              deactivated: true
            }
          });
        } else {
          SEROAccounts.updateAll(account._id, {
            $unset: {
              deactivated: ""
            }
          });
        }

        accounts = _.without(accounts, account.address);
      });

      // ADD missing accounts
      var accountsCount = visibleAccounts.length + 1;
      _.each(accounts, function(address) {
        web3.ser.getBalance(address, function(e, balance) {
          if (!e) {
            if (balance.toFixed) {
              balance = balance.toFixed();
            }

            web3.ser.getCoinbase(function(error, coinbase) {
              if (error) {
                console.warn("getCoinbase error: ", error);
                coinbase = null; // continue with null coinbase
              }

              var doc = SEROAccounts.findAll({
                address: address
              }).fetch()[0];

              var insert = {
                type: "account",
                address: address,
                balance: balance,
                name:
                  address === coinbase
                    ? "Main account (SERObase)"
                    : "Account " + accountsCount
              };

              if (doc) {
                SEROAccounts.updateAll(doc._id, {
                  $set: insert
                });
              } else {
                SEROAccounts.insert(insert);
              }

              if (address !== coinbase) accountsCount++;
            });
          }
        });
      });
    }
  });
};

/**
Builds the query with the addition of "{deactivated: {$exists: false}}"

@method _addToQuery
@param {Mixed} arg
@param {Object} options
@param {Object} options.includeDeactivated If set then de-activated accounts are also included.
@return {Object} The query
*/
SEROAccounts._addToQuery = function(args, options) {
  var _this = this;

  options = _.extend(
    {
      includeDeactivated: false
    },
    options
  );

  var args = Array.prototype.slice.call(args);

  if (_.isString(args[0])) {
    args[0] = {
      _id: args[0]
    };
  } else if (!_.isObject(args[0])) {
    args[0] = {};
  }

  if (!options.includeDeactivated) {
    args[0] = _.extend(args[0], {
      deactivated: { $exists: false }
    });
  }

  return args;
};

/**
Find all accounts, besides the deactivated ones

@method find
@return {Object} cursor
*/
SEROAccounts.find = function() {
  return this._collection.find.apply(this, this._addToQuery(arguments));
};

/**
Find all accounts, including the deactivated ones

@method findAll
@return {Object} cursor
*/
SEROAccounts.findAll = function() {
  return this._collection.find.apply(
    this,
    this._addToQuery(arguments, {
      includeDeactivated: true
    })
  );
};

/**
Find one accounts, besides the deactivated ones

@method findOne
@return {Object} cursor
*/
SEROAccounts.findOne = function() {
  return this._collection.findOne.apply(this, this._addToQuery(arguments));
};

/**
Update accounts, besides the deactivated ones

@method update
@return {Object} cursor
*/
SEROAccounts.update = function() {
  return this._collection.update.apply(this, this._addToQuery(arguments));
};

/**
Update accounts, including the deactivated ones

@method updateAll
@return {Object} cursor
*/
SEROAccounts.updateAll = function() {
  return this._collection.update.apply(
    this,
    this._addToQuery(arguments, {
      includeDeactivated: true
    })
  );
};

/**
Update accounts, including the deactivated ones

@method upsert
@return {Object} cursor
*/
SEROAccounts.upsert = function() {
  return this._collection.upsert.apply(
    this,
    this._addToQuery(arguments, {
      includeDeactivated: true
    })
  );
};

/**
Starts fetching and watching the accounts

@method init
*/
SEROAccounts.init = function() {
  var _this = this;

  if (typeof web3 === "undefined") {
    console.warn(
      "SEROAccounts couldn't find web3, please make sure to instantiate a web3 object before calling SEROAccounts.init()"
    );
    return;
  }

  Tracker.nonreactive(function() {
    _this._addAccounts();

    _this._updateBalance();
    _this._watchBalance();

    // check for new accounts every 2s
    Meteor.clearInterval(_this._intervalId);
    _this._intervalId = Meteor.setInterval(function() {
      _this._addAccounts();
    }, 2000);
  });
};
