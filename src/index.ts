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
          avatarUrl: f.avatar_url_full
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
      this.client.on('loggedOn', (err) => {
        this.puppetBridge.sendStatusMsg({}, 'connected');

        this.client.setPersona(SteamUser.EPersonaState.Online);
      });
      this.client.once('steamGuard', (err) => {
        this.puppetBridge.sendStatusMsg({}, `TODO: Steam guard is enabled, can't connect.`);
      });
      this.client.once('error', (err) => {
        this.puppetBridge.sendStatusMsg({}, `unable to connect to steam; ${err}`);
      });
      
      return this.client.logOn({
        accountName: this.config.account_name,
        password: this.config.password,
        loginKey: this.config.login_key,
        logonID: this.config.login_id || 12345, // Perhaps base on the mxid somehow?
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
          avatarUrl: friend.avatar_url_full,
          isDirect: true,
        };

        resolve(payload);
      } else {
        if (sid.getSteamID64() in this.client.chats)
        {
          let chat = this.client.chats[sid.getSteamID64()];

          let payload = <RoomData>{
            name: room.name,
            topic: 'Steam Chat',
            isDirect: false,
          };

          if (sid.isGroupChat()) {
            let groupId = new SteamID(sid);
            groupId.type = SteamID.Type.CLAN;
            groupId.instance &= ~SteamID.ChatInstanceFlags.Clan;

            let group = this.client.groups[groupId];
            if (group) {
              let hash = group.name_info.sha_avatar;
              if (hash === '0000000000000000000000000000000000000000') {
                hash = 'fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb';
              }
              payload.avatarUrl = `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/${hash.substring(0,2)}/${hash}_full.jpg`;
            } else {
              // TODO: Get group information somehow
            }
          }
        }
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

        if (friend) {
          resolve(<UserData> {
            name: friend.player_name,
            avatarUrl: friend.avatar_url_full,
          });
        } else {
          this.client.getPersonas([sid], (result) => {
            friend = result[sid];
            resolve(<UserData> {
              name: friend.player_name,
              avatarUrl: friend.avatar_url_full,
            });
          });
        }
      }
    });
  }
}
