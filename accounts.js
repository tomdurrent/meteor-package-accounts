/**

 @module SeroCash:accounts
 */

/**
 The accounts collection, with some SeroCash additions.

 @class SeroAccounts
 @constructor
 */

var tokenInterface = [
    {
        "type": "function",
        "name": "name",
        "constant": true,
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ]
    },
    {
        "type": "function",
        "name": "decimals",
        "constant": true,
        "inputs": [
            {
                "name": "",
                "type": "string"
            }],
        "outputs": [
            {
                "name": "",
                "type": "uint8"
            }
        ]
    },
    {
        "type": "function",
        "name": "balanceOf",
        "constant": true,
        "inputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ]
    },
    {
        "type": "function",
        "name": "symbol",
        "constant": true,
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ]
    },
    {
        "type": "function",
        "name": "transfer",
        "constant": false,
        "inputs": [
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "outputs": []
    },
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "_supply",
                "type": "uint256"
            },
            {
                "name": "_name",
                "type": "string"
            },
            {
                "name": "_decimals",
                "type": "uint8"
            },
            {
                "name": "_symbol",
                "type": "string"
            }
        ]
    },
    {
        "name": "Transfer",
        "type": "event",
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "value",
                "type": "uint256"
            }
        ]
    },
    {
        "constant":false,
        "inputs":[
            {
                "name":"_spender",
                "type":"address"
            },
            {
                "name":"_value",
                "type":"uint256"
            }
        ],
        "name":"approve",
        "outputs":[
            {
                "name":"success",
                "type":"bool"
            }
        ],
        "type":"function"
    },
    {
        "constant":true,
        "inputs":[
            {
                "name":"",
                "type":"address"
            },
            {
                "name":"",
                "type":"address"
            }
        ],
        "name":"allowance",
        "outputs":[
            {
                "name":"",
                "type":"uint256"
            }
        ],
        "type":"function"
    }
];

var collection = new Mongo.Collection('sero_accounts', {connection: null});
SeroAccounts = _.clone(collection);
SeroAccounts._collection = collection;


if (typeof PersistentMinimongo !== 'undefined')
    new PersistentMinimongo(SeroAccounts._collection);


SeroAccounts._watching = false;

/**
 Updates the accounts balances, by watching for new blocks and checking the balance.

 @method _watchBalance
 */

SeroAccounts._watchBalance = function () {
    var _this = this;

    this._watching = true;

    // UPDATE SIMPLE ACCOUNTS balance on each new block
    web3.sero.filter('latest').watch(function (e, res) {
        if (!e) {
            _this._updateBalance();
        }
    });
};

/**
 Updates the accounts balances.

 @method _updateBalance
 */

SeroAccounts._updateBalance = function () {
    var _this = this;

    _.each(SeroAccounts.find({
        network: _this.network,
    }).fetch(), function (account) {
        web3.sero.getBalance(account.address, function (err, res) {
            if (!err) {
                var tempBal = 0;

                if (typeof res.tkn !== 'undefined') {
                    if (typeof res.tkn.SERO !== 'undefined') {
                        tempBal = res.tkn.SERO.toString(10);
                    }
                }

                var tkns = [], tkts = [];
                if (typeof res.tkn !== 'undefined') {
                    var tkn = res.tkn
                    Object.keys(tkn).forEach(function(key){
                        if(key !== 'SERO'){
                            web3.sero.cyToContractAddress(key,function (err, address) {
                                if (!err) {
                                    var TokenContract = web3.sero.contract(tokenInterface);
                                    var instance = TokenContract.at(address);
                                    instance.decimals(key,function(e, i){
                                        tkns.push({
                                            address:address,
                                            currency:key,
                                            value:tkn[key].toString(10),
                                            decimals:i.toString(10),
                                        })
                                    });
                                }
                            });
                        }
                    });
                }

                if (typeof res.tkt !== 'undefined') {
                    var tkt = res.tkt
                    Object.keys(tkt).forEach(function(key){
                        tkts.push({
                            category:key,
                            hash:tkt[key]
                        })
                    });
                }

                SeroAccounts.update(account._id, {
                    $set: {
                        balance: tempBal,
                        tkns: tkns,
                        tkts: tkts
                    }
                });

            }else{
                SeroAccounts.remove(account._id);
            }
        });
    });
};

/**
 Updates the accounts list,
 if its finds a difference between the accounts in the collection and the accounts in the accounts array.

 @method _addAccounts
 */

SeroAccounts._addAccounts = function () {
    var _this = this;

    // UPDATE normal accounts on start
    web3.sero.getAccounts(function (e, accounts) {
        if (!e) {
            var visibleAccounts = _.pluck(SeroAccounts.find().fetch(), 'address');

            if (!_.isEmpty(accounts) &&
                _.difference(accounts, visibleAccounts).length === 0 &&
                _.difference(visibleAccounts, accounts).length === 0)
                return;


            var localAccounts = SeroAccounts.findAll().fetch();

            // if the accounts are different, update the local ones
            _.each(localAccounts, function (account) {

                // needs to have the balance
                if (!account.balance)
                    return;

                // set status deactivated, if it seem to be gone
                if (!_.contains(accounts, account.address)) {
                    SeroAccounts.updateAll(account._id, {
                        $set: {
                            deactivated: true
                        }
                    });
                } else {
                    SeroAccounts.updateAll(account._id, {
                        $unset: {
                            deactivated: ''
                        }
                    });
                }
                accounts = _.without(accounts, account.address);
            });

            // ADD missing accounts
            var accountsCount = visibleAccounts.length + 1;
            _.each(accounts, function (address) {

                web3.sero.getBalance(address, function (e, balance) {
                    if (!e) {
                        web3.sero.getCoinbase(function (e, coinbase) {
                            var doc = SeroAccounts.findAll({
                                address: address,
                            }).fetch()[0];
                            var tempBal = 0;
                            if (typeof balance.tkn !== 'undefined') {
                                if (typeof balance.tkn.SERO !== 'undefined') {
                                    tempBal = balance.tkn.SERO;
                                }
                            }

                            var tkns = [], tkts = [];
                            if (typeof balance.tkn !== 'undefined') {
                                var tkn = balance.tkn
                                Object.keys(tkn).forEach(function(key){
                                    if(key !== 'SERO'){
                                        web3.sero.cyToContractAddress(key,function (err, address) {
                                            if (!err) {
                                                var TokenContract = web3.sero.contract(tokenInterface);
                                                var instance = TokenContract.at(address);
                                                instance.decimals(key,function(e, i){
                                                    tkns.push({
                                                        address:address,
                                                        currency:key,
                                                        value:tkn[key].toString(10),
                                                        decimals:i.toString(10),
                                                    })
                                                });
                                            }
                                        });
                                    }
                                });
                            }

                            if (typeof balance.tkt !== 'undefined') {
                                var tkt = balance.tkt
                                Object.keys(tkt).forEach(function(key){
                                    tkts.push({
                                        category:key,
                                        hash:tkt[key]
                                    })
                                });
                            }

                            var insert = {
                                type: 'account',
                                address: address,
                                tkns: tkns,
                                tkts: tkts,
                                balance: tempBal.toString(10),
                                name: (address === coinbase) ? 'Main account (Serobase)' : 'Account ' + accountsCount
                            };

                            if (doc) {
                                SeroAccounts.updateAll(doc._id, {
                                    $set: insert
                                });
                            } else {
                                SeroAccounts.insert(insert);
                            }

                            if (address !== coinbase)
                                accountsCount++;
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

SeroAccounts._addToQuery = function (args, options) {
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
            deactivated: {$exists: false}
        });
    }

    return args;
};

/**
 Find all accounts, besides the deactivated ones

 @method find
 @return {Object} cursor
 */

SeroAccounts.find = function () {
    return this._collection.find.apply(this, this._addToQuery(arguments));
};

/**
 Find all accounts, including the deactivated ones

 @method findAll
 @return {Object} cursor
 */

SeroAccounts.findAll = function () {
    return this._collection.find.apply(this, this._addToQuery(arguments, {
        includeDeactivated: true
    }));
}

/**
 Find one accounts, besides the deactivated ones

 @method findOne
 @return {Object} cursor
 */

SeroAccounts.findOne = function () {
    return this._collection.findOne.apply(this, this._addToQuery(arguments));
};

/**
 Update accounts, besides the deactivated ones

 @method update
 @return {Object} cursor
 */

SeroAccounts.update = function () {
    return this._collection.update.apply(this, this._addToQuery(arguments));
};

/**
 Update accounts, including the deactivated ones

 @method updateAll
 @return {Object} cursor
 */

SeroAccounts.updateAll = function () {
    return this._collection.update.apply(this, this._addToQuery(arguments, {
        includeDeactivated: true
    }));
}

/**
 Update accounts, including the deactivated ones

 @method upsert
 @return {Object} cursor
 */

SeroAccounts.upsert = function () {
    return this._collection.upsert.apply(this, this._addToQuery(arguments, {
        includeDeactivated: true
    }));
}

/**
 Insert an account

 @method insert
 @return {Object} cursor
 */
SeroAccounts.insert = function (data) {
    return this._collection.insert.call(this, _.extend(data, {
        network: this.network,
    }));
}


/**
 Starts fetching and watching the accounts

 @method init
 */

SeroAccounts.init = function (opts) {
    var _this = this;

    if (typeof web3 === 'undefined') {
        console.warn('SeroAccounts couldn\'t find web3, please make sure to instantiate a web3 object before calling SeroAccounts.init()');
        return;
    }

    if (opts && !opts.network) {
        throw new Error('Network id not given');
    } else if (opts && opts.network) {
        // network id
        _this.network = opts.network;
    }


    /**
     Overwrite web3.reset, to also stop the interval

     @method web3.reset
     */
    web3._reset = Web3.prototype.reset;
    web3.reset = function (keepIsSyncing) {
        Meteor.clearInterval(_this._intervalId);
        Meteor.clearInterval(_this._intervalId2);
        _this._watching = false;
        web3._reset(keepIsSyncing);
    };

    Tracker.nonreactive(function () {

        _this._addAccounts();

        if (!_this._watching) {
            _this._updateBalance();
            _this._watchBalance();

            // check for new accounts every 2s
            Meteor.clearInterval(_this._intervalId);
            Meteor.clearInterval(_this._intervalId2);
            _this._intervalId = Meteor.setInterval(function () {
                _this._addAccounts();
            }, 2000);

            _this._intervalId2 = Meteor.setInterval(function () {
                _this._updateBalance();
            }, 10000);
        }
    });
};