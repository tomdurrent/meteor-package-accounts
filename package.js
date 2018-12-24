Package.describe({
  name: 'serocash:accounts',
  summary: 'Provides and updates the serocash accounts in the Accounts collection',
  version: '0.2.4',
  git: 'http://github.com/tomdurrent/meteor-package-accounts'
});

Package.onUse(function(api) {
  api.versionsFrom("1.0");
  api.use("underscore", ["client", "server"]);
  api.use("mongo@1.1.7", ["client", "server"]);

  api.use('frozeman:persistent-minimongo@0.1.8', 'client');
  api.use('serocash:web3@0.2.6', ['client', 'server']);

  api.export(['SeroAccounts'], ['client', 'server']);


  api.addFiles("accounts.js", ["client", "server"]);
});

// Package.onTest(function(api) {
//   api.use('tinytest');
//   api.use('serocash:accounts');
//   api.addFiles('accounts-tests.js');
// });
