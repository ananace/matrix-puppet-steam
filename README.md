TODO
====

- Support adding Steam connections
  - During runtime
  - From config
- Handle events properly
- Do chat-rooms on Steam the right way
- Unify SteamID translation to user localpart
- Add in bang commands for Steam features
  - Status (Online, Offline, Away, DND, Looking\*)
  - Status icon (Web, SteamOS, Big Picture)
  - Private group chats
  - Nick changes
  - Aliases
  - etc
- Syncronize more Matrix state

Installation
============

Requires a recent-ish version of Node, probably.

```
$ git clone git://github.com/ace13/matrix-puppet-steam
$ cd matrix-puppet-steam
$ npm install
```

Setup
=====

1. Copy the `config.sample.json` file to `config.json`, modify the values in there to your content.
2. Generate the registration file with
    ```
    $ node index.js --generate-registration -c config.json -f steam-registration.yaml -u <appservice url>:<appservice port>
    ```
3. Copy the registration file to your homeserver and add it to the `app_service_config_files` list.
4. Start the application service, `forever` and `node` should both work.
    ```
    $ forever start index.js -c config.json
    $ node index.js -c config.json
    ```
