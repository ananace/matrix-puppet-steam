const debug = require('debug')('matrix-puppet:steam:app');
const { MatrixPuppetBridgeBase } = require("matrix-puppet-bridge");
const Client = require('steam-user');
const Promise = require('bluebird');
const UInt64 = require('cuint').UINT64;

class App extends MatrixPuppetBridgeBase {
  setSteamAccount(accountName, accountToken) {
    this._accountName = accountName;
    this._accountToken = accountToken;
  }

  getServiceName() {
    return 'Steam';
  }

  getServicePrefix() {
    return 'steam';
  }

  initThirdPartyClient() {
    this.client = new Client({
      promptSteamGuardCode: false,
    });

    return new Promise((resolve,reject) => {
      this.client.once('loggedOn', resolve);
      this.client.once('steamGuard', reject); // Shouldn't happen, but still.
      this.client.once('error', reject);

      this.client.logOn({
        accountName: this._accountName,
        loginKey: this._accountToken,
        logonID: 12345,
        machineName: 'Matrix Puppet-bridge',
      });
    });
  }

  registerMessageListener() {
    this.client.on('friendOrChatMessage', (senderId, text, roomId)=>{
      let payload = {
        roomId: new UInt64(roomId.getSteamID64(), 10).toString(36),
        text: text
      };

      const sender = this.client.users[senderId.getSteamID64()];

      payload.senderId = new UInt64(senderId.getSteamID64(), 10).toString(36);
      payload.senderName = sender.player_name;
      payload.avatarUrl = sender.avatar_url_icon; 

      return this.handleThirdPartyRoomMessage(payload).catch(err=>{
        console.error(err);
      });
    });

    debug('registered message listener');
  }

  getThirdPartyRoomDataById(id) {
    const room = this.client.chats[new UInt64(id, 36).toString()];
    return {
      name: room.name,
      topic: room.name || 'Private chat',
    };
  }

  sendMessageAsPuppetToThirdPartyRoomWithId(id, text) {
    debug('sending message as puppet to third party room with id', id);
    return this.client.chatMessage(new UInt64(id, 36).toString(), text);
  }
}

module.exports = App;
