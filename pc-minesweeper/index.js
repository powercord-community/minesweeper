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
        const spoilerComponents = [];

        function checkVictory () {
          const notRevealed = message.minesweeper.tiles
            .flatMap(t => t)
            .filter(t => !t.revealed);

          const flagged = notRevealed
            .filter(t => t.flagged);

          if (notRevealed.length === flagged.length) {
            if (flagged.filter(t => t.type !== TileType.BOMB) === 0) {
              message.minesweeper.victory = true;
            }
          }
        }

        for (const spoiler of spoilers) {
          const spoilerComponent = _this.getParent(getOwnerInstance(spoiler), 'Spoiler');
          spoilerComponents.push(spoilerComponent);

          const child = spoilerComponent._reactInternalFiber.child.child.child.stateNode;

          const index = spoilers.findIndex(e => e === child.ref);

          const y = Math.floor(index / message.minesweeper.tiles[0].length);
          const x = index % message.minesweeper.tiles[0].length;

          const tile = message.minesweeper.tiles[y][x];

          spoilerComponent.props.tile = tile;

          child.ref.addEventListener('click', (e) => {
            if (!message.minesweeper.victory && !tile.flagged && !tile.revealed) {
              tile.revealed = true;
              tile.flagged = false;

              if (tile.type === TileType.BOMB) {
                tile.exploded = true;

                child.ref.children[0].style.display = 'none';
                child.ref.innerHTML += '<img src="/assets/ef756c6ecfdc1cf509cb0175dd33c76d.svg" class="emoji" alt=":boom:" draggable="false">';

                const audio = new Audio('https://my.mixtape.moe/ugeaji.mp3');
                audio.play();

                spoilerComponents.forEach((component) => {
                  component.setState({ visible: true });

                  const childComponent = component._reactInternalFiber.child.child.child.stateNode;
                  if (component.props.tile.flagged) {
                    childComponent.ref.children[0].style.display = '';
                    childComponent.ref.children[1].remove();
                  }

                  component.props.tile.revealed = true;
                  component.props.tile.flagged = false;
                });

                ComponentDispatch.dispatch(ComponentActions.SHAKE_APP, {
                  duration: 1600,
                  intensity: 10
                });
              } else {
                checkVictory();
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

            if (!message.minesweeper.victory && !tile.revealed) {
              tile.flagged = !tile.flagged;

              if (tile.flagged) {
                child.ref.children[0].style.display = 'none';
                child.ref.innerHTML += '<img src="/assets/a1f0c106b0a0f68f6b11c2dc0cc8d249.svg" class="emoji" alt=":triangular_flag_on_post:" draggable="false">';
              } else {
                child.ref.children[0].style.display = '';
                child.ref.children[1].remove();
              }

              checkVictory();
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
