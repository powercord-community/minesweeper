function random(max) {
    return Math.floor(Math.random() * max);
}

const emojis = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    'bomb': 'bomb'
}

const TileType = Object.freeze({
    BOMB: 'BOMB',
    NUMBER: 'NUMBER'
});

module.exports.TileType = TileType;

module.exports.createTiles = function(size = 10, bombs = size) {
    const defaultObject = {
        type: TileType.NUMBER,
        bombs: 0, 
        revealed: false, 
        flagged: false
    };

    const tiles = Array(size).fill().map(() => Array(size).fill().map(() => Object.assign({}, defaultObject)));

    for(let i = 0; i < bombs; i++) {
        while(tiles[y = random(size)][x = random(size)]['type'] === TileType.BOMB);

        tiles[y][x] = { 
            type: TileType.BOMB, 
            revealed: false, 
            flagged: false 
        };
    }

    for(let y = 0; y < tiles.length; y++) {
        for(let x = 0; x < tiles.length; x++) {
            if(tiles[y][x]['type'] !== TileType.BOMB) {
                for(let dy = -1; dy <= 1; dy++) {
                    for(let dx = -1; dx <= 1; dx++) {
                        if((y + dy >= 0 && y + dy < size) && (x + dx >= 0 && x + dx < size)) {
                            tiles[y][x]['bombs'] += (tiles[y + dy][x + dx]['type'] === TileType.BOMB)
                        }
                    }
                }
            }
        }
    }

    return tiles;
}

module.exports.toMessage = function(tiles) {
    return tiles.map(y => y.map(x => `||:${emojis[x['type'] === TileType.BOMB ? 'bomb' : x['bombs']]}:||`).join("") + "\n").join("");
}

/* Temporary, maybe? */
module.exports.parseMessage = function(content) {
    const emojiValues = Object.values(emojis);
    const emojiKeys = Object.keys(emojis);

    return content.replace(/\|/g, '').split('\n').slice(0, -1).map(y => y.slice(1, -1).split('::').map(x => {
        const value = emojiKeys[emojiValues.findIndex(k => k === x)];

        if(value === 'bomb') {
            return {
                type: TileType.BOMB,
                revealed: false,
                flagged: false
            }
        }else{
            return {
                type: TileType.NUMBER,
                bombs: Number.parseInt(value),
                revealed: false,
                flagged: false
            }
        }
    }));
}