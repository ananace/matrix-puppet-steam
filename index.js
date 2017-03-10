const config = require('./config.json');
const {
  MatrixAppServiceBridge: {
    Bridge, Cli, AppServiceRegistration
  },
  Puppet,
} = require("matrix-puppet-bridge");
const puppet = new Puppet('./config.json');
const debug = require('debug')('matrix-puppet:steam');
const SteamUser = require('steam-user');
const Promise = require('bluebird');
const App = require('./app');

new Cli({
  port: config.port,
  registrationPath: config.registrationPath,
  generateRegistration: function(reg, callback) {
    puppet.associate().then(()=>{
      reg.setId(AppServiceRegistration.generateToken());
      reg.setHomeserverToken(AppServiceRegistration.generateToken());
      reg.setAppServiceToken(AppServiceRegistration.generateToken());
      reg.setSenderLocalpart('steam_bot');
      reg.addRegexPattern("users", '@steam_.*', true);
      callback(reg);
    }).catch(err=>{
      console.error(err.message);
      process.exit(-1);
    });
  },
  run: function(port) {
    var appList = [];

    const getAppsFromMatrixRoomId = (room_id) => {
      return new Promise((resolve, reject) => {
        let apps = [];
        appList.each((app)=>{
          let steamRoomId = app.getThirdPartyRoomIdFromMatrixRoomId(room_id);
          let steamRoom = app.client.chats[steamRoomId];
          if (steamRoom) {
            apps += app;
          }
        });

        return apps.length > 0 ? resolve(apps) : reject(new Error('could not find any Steam apps for matrix room id', room_id));
      });
    };

    const bridge = new Bridge(Object.assign({}, config.bridge, {
      controller: {
        onUserQuery: function(queriedUser) {
          console.log('got user query', queriedUser);
          return {}; // auto provision users w no additional data
        },

        onEvent: function(req, ctx) {
          const { room_id } = req.getData();
          debug('event in room id', room_id);

          if (room_id) {
            getAppsFromMatrixRoomId(room_id).then((apps) => {
              debug('got apps from matrix room id');
              apps.each((app) => {
                app.handleMatrixEvent(req, ctx);
              });
            }).catch(err=>{
              debug('could not get app for matrix room id');
              console.error(err);
            });
          }
        },
        onAliasQuery: function() {
          console.log('on alias query');
        },
        thirdPartyLookup: {
          protocols: [ 'steam' ],
          getProtocol: function() {
            console.log('get proto');
          },
          getLocation: function() {
            console.log('get loc');
          },
          getUser: function() {
            console.log('get user');
          }
        }
      }
    }));

    return bridge.run(port, config).then(()=>{
      return puppet.startClient();
    }).then(()=>{
      return Promise.mapSeries(config.static, (account) => {
        let loginNeeded = !account.token;
        if (loginNeeded) {
          console.log("Retrieving token for account " + account.name);
          let user = new SteamUser();

          user.on('loginKey', (data) => {
            account.token = data.key;
          });
          user.logOn({
            accountName: account.name,
            logonID: 12345,
            machineName: 'Matrix Puppet-bridge',
            rememberPassword: true,
          });
        }

        const app = new App(account.name, account.token);
        return app.initThirdPartyClient().then(() => {
          debug('Account ' + account.name + ' added.');
          return app;
        }).catch(err=> {
          debug('Failed to init account ' + account.name, err.message);
          return app;
        });
      });
    }).then(()=>{
      console.log('Matrix-side listening on port %s', port);
    }).catch(err=>{
      console.error(err.stack);
      process.exit(-1);
    });
  }
}).run();
