Package.describe({
  name: "serocash:accounts",
  summary:
    "Provides and updates the sero accounts in the Accounts collection",
  version: "1.1.0",
  git: "http://github.com/tomdurrent/meteor-package-accounts"
});

Package.onUse(function(api) {
  api.versionsFrom("1.0");
  api.use("underscore", ["client", "server"]);
  api.use("mongo", ["client", "server"]);

  api.use("frozeman:persistent-minimongo@0.1.8", "client");
  api.use("serocash:web3@0.0.1", ["client", "server"]);

  api.export(["SEROAccounts"], ["client", "server"]);

  api.addFiles("accounts.js", ["client", "server"]);
});

// Package.onTest(function(api) {
//   api.use('tinytest');
//   api.use('ethereum:accounts');
//   api.addFiles('accounts-tests.js');
// });
