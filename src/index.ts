import {
  ThirdPartyAdapter,
  
  download, entities,
  
  ThirdPartyPayload, ThirdPartyMessagePayload, ThirdPartyImageMessagePayload,
  UserData, RoomData,

  ContactListUserData
} from 'matrix-puppet-bridge';

import { SteamUser } from 'steam-user';
import { UINT64 as UInt64 } from 'cuint';

export class Adapter extends ThirdPartyAdapter {
  public serviceName = 'Steam';
  private client : SteamUser = null;

  initClient(): Promise<void> {
    this.client = new SteamUser({
      promptSteamGuardCode: false // Should be possible to route to the client
    });

    this.client.on('friendPersonasLoaded', () => {
      this.puppetBridge.newUsers(this.client.users.values.map((f) => {
        return <ContactListUserData>{
          name: f.player_name,
          userId: f.friendid.to_string(36),
          avatarUrl: f.avatar_url_icon
        };
      }));
    });

    return Promise.resolve();
  }

  startClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('loggedOn', resolve);
      this.client.once('steamGuard', reject);
      this.client.once('error', reject);
      
      this.client.logOn({
        accountName: 'account',
        loginKey: 'accountToken',
        logonID: 12345, // Perhaps base on the mxid somehow.
        machineName: 'Matrix Puppet-Bridge',
      });
    });
  }

  sendMessage(thirdPartyRoomId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let roomId = new UInt64(thirdPartyRoomId, 36).toString();
      if (this.client.chatMessage(roomId, text))
        resolve();
      else
        reject();
    });
  }

  sendImageMessage(thirdPartyRoomId: string, Image): Promise<void> {
    return Promise.reject(null);
  }

  getRoomData(thirdPartyRoomId: string): Promise<RoomData> {
    return new Promise<RoomData>((resolve, reject) => {
      let payload = <RoomData>{
        name: '',
        topic: '',
        avatarUrl: '',
        isDirect: true,
      };

      resolve(payload);
    });
  }

  getUserData(thirdPartyUserId: string): Promise<UserData> {
    return null;
  }
}
