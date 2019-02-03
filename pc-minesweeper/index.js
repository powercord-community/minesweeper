const Plugin = require('powercord/Plugin');

const {
  getModuleByDisplayName,
  getModule,
  channels: {
    getChannelId
  },
  constants: {
    ComponentActions
  },
  messages: {
    createBotMessage,
    receiveMessage
  }
} = require('powercord/webpack');

const { inject, uninject } = require('powercord/injector');
const { getOwnerInstance } = require('powercord/util');

const { createTiles, toMessage, parseMessage, TileType } = require('./minesweeper');

const { BOT_AVATARS } = getModule([ 'BOT_AVATARS' ]);
const { ComponentDispatch } = getModule([ 'ComponentDispatch' ]);

module.exports = class Minesweeper extends Plugin {
  sendPlayArea (tiles) {
    const receivedMessage = createBotMessage(getChannelId(), '');
    receivedMessage.author.username = 'Minesweeper';
    receivedMessage.author.avatar = 'minesweeper';

    receivedMessage.content = toMessage(tiles);

    return receiveMessage(receivedMessage.channel_id, receivedMessage);
  }

  getParent (component, componentType) {
    let internal = component._reactInternalFiber;

    do {
      if (internal.type !== null && (internal.type.displayName || internal.type) === componentType) {
        return internal.stateNode;
      }
    } while ((internal = internal.return) !== null);

    return null;
  }

  async start () {
    BOT_AVATARS.minesweeper = 'https://i.imgur.com/LGQUFYQ.png';

    const _this = this;

    const MessageContent = getModuleByDisplayName('MessageContent');
    inject('pc-minesweeper-message', MessageContent.prototype, 'componentDidMount', function (args, res) { // eslint-disable-line func-names
      const { message } = this.props;
      if (message.author.id === '1' && message.author.username === 'Minesweeper') {
        if (!message.minesweeper) {
          message.minesweeper = {
            tiles: parseMessage(message.content)
          };
        }

        const spoilers = [ ...this._reactInternalFiber.child.child.stateNode.children[1].children ];
        for (const spoiler of spoilers) {
          const spoilerComponent = _this.getParent(getOwnerInstance(spoiler), 'Spoiler');
          const child = spoilerComponent._reactInternalFiber.child.child.child.stateNode;

          const index = spoilers.findIndex(e => e === child.ref);

          const y = Math.floor(index / message.minesweeper.tiles[0].length);
          const x = index % message.minesweeper.tiles[0].length;

          const tile = message.minesweeper.tiles[y][x];

          child.ref.addEventListener('click', (e) => {
            if (!tile.flagged && !tile.revealed) {
              tile.revealed = true;
              tile.flagged = false;

              if (tile.type === TileType.BOMB) {
                tile.exploded = true;

                child.ref.children[0].style.display = 'none';
                child.ref.innerHTML += '<img src="/assets/ef756c6ecfdc1cf509cb0175dd33c76d.svg" class="emoji" alt=":boom:" draggable="false">';

                message.minesweeper.tiles.forEach((tiles) => {
                  tiles.forEach((t) => {
                    t.revealed = true;
                    t.flagged = false;
                  });
                });

                spoilers.forEach((element) => {
                  _this.getParent(getOwnerInstance(element), 'Spoiler').setState({ visible: true });
                });

                ComponentDispatch.dispatch(ComponentActions.SHAKE_APP, {
                  duration: 800,
                  intensity: 10
                });
              }
            } else {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          });

          child.ref.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (!tile.revealed) {
              tile.flagged = !tile.flagged;

              if (tile.flagged) {
                child.ref.children[0].style.display = 'none';
                child.ref.innerHTML += '<img src="/assets/a1f0c106b0a0f68f6b11c2dc0cc8d249.svg" class="emoji" alt=":triangular_flag_on_post:" draggable="false">';
              } else {
                child.ref.children[0].style.display = '';
                child.ref.children[1].remove();
              }
            }
          });

          if (tile.flagged) {
            child.ref.children[0].style.display = 'none';
            child.ref.innerHTML += '<img src="/assets/a1f0c106b0a0f68f6b11c2dc0cc8d249.svg" class="emoji" alt=":triangular_flag_on_post:" draggable="false">';
          }

          if (tile.revealed) {
            spoilerComponent.setState({ visible: true });
          }

          if (tile.exploded) {
            child.ref.children[0].style.display = 'none';
            child.ref.innerHTML += '<img src="/assets/ef756c6ecfdc1cf509cb0175dd33c76d.svg" class="emoji" alt=":boom:" draggable="false">';
          }
        }
      }

      return res;
    });

    powercord
      .pluginManager
      .get('pc-commands')
      .register(
        'minesweeper',
        'Play a game of minesweeper',
        '{c} <size> <bombs>',
        (args) => {
          if (args.length > 2) {
            return 'Too many arguments';
          }

          const size = Math.max(Math.min(Number.parseInt(args.length >= 1 ? args[0] : '') || 10, 14), 1);
          const bombs = Math.max(Math.min((() => {
            if (args.length === 2) {
              const argument = args[1];
              if (argument.endsWith('%')) {
                const percentage = Number.parseInt(argument.slice(0, -1));
                if (percentage) {
                  return Math.round((size * size) * (Math.min(percentage, 100) / 100));
                }
              } else {
                const percentage = Number.parseFloat(argument);
                if (percentage) {
                  if (percentage > 0 && percentage < 1) {
                    return Math.round((size * size) * percentage);
                  }

                  return Number.parseInt(percentage);
                }
              }
            }

            return size;
          })(), size * size), 1);

          this.sendPlayArea(createTiles(size, bombs));

          return null;
        }
      );
  }

  unload () {
    powercord
      .pluginManager
      .get('pc-commands')
      .unregister('minesweeper');

    delete BOT_AVATARS.minesweeper;

    uninject('pc-minesweeper-spoiler');
  }
};
