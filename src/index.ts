import {
  ThirdPartyAdapter,
  
  download, entities,
  
  ThirdPartyPayload, ThirdPartyMessagePayload, ThirdPartyImageMessagePayload,
  UserData, RoomData,

  ContactListUserData
} from 'matrix-puppet-bridge';

import { SteamUser } from 'steam-user';
import { SteamID } from 'steamid';
import { UINT64 as UInt64 } from 'cuint';

export class Adapter extends ThirdPartyAdapter {
  public serviceName = 'Steam';
  private client : SteamUser = null;

  initClient(): Promise<void> {
    this.client = new SteamUser({
      promptSteamGuardCode: false // XXX: Should be possible to route to the client
    });

    this.client.on('friendPersonasLoaded', () => {
      this.puppetBridge.newUsers(this.client.users.values.map((f) => {
        return <ContactListUserData>{
          name: f.player_name,
          userId: f.friendid.toString(36),
          avatarUrl: f.avatar_url_icon // XXX: Maybe use a larger avatar
        };
      }));
    });

    this.client.on('friendOrChatMessage', (sender, message, room) => {
      let friend = this.client.friends[sender];
      if (friend) {
        this.puppetBridge.sendMessage(<ThirdPartyMessagePayload>{
          roomId: room.toString(36),
          senderName: friend.player_name,
          senderId: sender.toString(36),
          avatarUrl: friend.avatar_url_full,
          text: message,
        });
      } else {
        this.client.getPersonas([sender], (result) => {
          friend = result[sender];
          this.puppetBridge.sendMessage(<ThirdPartyMessagePayload>{
            roomId: room.toString(36),
            senderName: friend.player_name,
            senderId: sender.toString(36),
            avatarUrl: friend.avatar_url_full,
            text: message,
          });
        });
      }
    });

    return Promise.resolve();
  }

  startClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('loggedOn', resolve);
      this.client.once('steamGuard', reject); // XXX: Do !steamguard
      this.client.once('error', reject);
      
      this.client.logOn({
        accountName: 'account',
        loginKey: 'accountToken',
        logonID: 12345, // Perhaps base on the mxid somehow?
        machineName: 'Matrix Puppet-Bridge',
      });
    });
  }

  sendMessage(thirdPartyRoomId: string, text: string): Promise<void> {
    let roomId = new UInt64(thirdPartyRoomId, 36).toString();
    this.client.chatMessage(roomId, text);

    return Promise.resolve();
  }

  sendImageMessage(thirdPartyRoomId: string, Image): Promise<void> {
    return Promise.reject(null);
  }

  getRoomData(thirdPartyRoomId: string): Promise<RoomData> {
    return new Promise<RoomData>((resolve, reject) => {
      let sid = new SteamID(new UInt64(thirdPartyRoomId, 36).toString());

      if (!sid.isValid()) {
        return reject();
      }

      if (sid.getSteamID64() in this.client.users) {
        let friend = this.client.users[sid.getSteamID64()];
        let payload = <RoomData>{
          name: friend.player_name,
          topic: 'Steam Friend',
          avatarUrl: friend.avatar_url_icon,
          isDirect: true,
        };

        resolve(payload);
      } else {
      }
    });
  }

  getUserData(thirdPartyUserId: string): Promise<UserData> {
    return new Promise<UserData>((resolve, reject) => {
      let sid = new SteamID(new UInt64(thirdPartyUserId, 36).toString());

      if (!sid.isValid()) {
        return reject();
      }

      if (sid.getSteamID64() in this.client.users) {
        let friend = this.client.users[sid.getSteamID64()];
        let payload = <UserData>{
          name: friend.player_name,
          avatarUrl: friend.avatar_url_full,
        };

        resolve(payload);
      }
    });
  }
}
