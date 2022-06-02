<img width="1051" alt="Screen Shot 2022-06-02 at 4 38 30 PM" src="https://user-images.githubusercontent.com/2236153/171733929-fa039b93-e698-401f-a1f7-b1eb02c0a427.png">

# Multiplayer Flappy Bird with Hathora

> A basic implementation of Flappy Bird with real-time multiplayer

## Overview

This is a simple game of Flappy Bird except up to 4 people can compete to see who gets to the end first while traversing through gaps between pipes.

Running into the ground or a pipe will reset you backwards giving your opponents a chance to take the lead.

[Try it out here!](https://flappy-bird-hathora.pages.dev) Send the link to friends to have them join.

## Latency Strategies

This game is server authoritative and utilizes client side prediction to provide immediate feedback to the player. Client and server are forced to simulate at a fixed 60fps.

For remote players, [dead reckoning](https://en.wikipedia.org/wiki/Dead_reckoning) is used to simulate where each player is likely to be in real-time. This will not always be accurate and a very basic mid-point nudge is used to move remote players towards their true position.

For the local player, the game is simulated immediately using the same logic as the server. But because the client will always be ahead of the last known server state, client side replay is used to approximate the true position of the local player each time server state is received.

In a perfect world, the replayed position is the same as the client's predicted position and no correction will be applied. But when there is a difference, the same basic mid-point nudge used for remote players is also used to move the local player towards their true position.

You can find the dead reckoning and client side replay implementation in `client/web/store/server.ts` which is a mobx state store. The normal game simulation is in `client/web/scenes/GameScene.ts`.

Pressing the `d` key will toggle a debug view of a filled in rectangle representing the last known server position of each player and a black outline rectangle representing the last predicted position.

### Improvements & Issues

High latency conditions will still appear jittery due to the simple mid-point nudge as players get instantly corrected by at least half the distance between where they are and where they should be. This can be mitigated by using some form of interpolation, adjusting things like velocity, or even slowing the client simulation down until things catch up.

Dropped or lost input packets are also not handled in this example. The client sends a ping that includes whether the space key was pressed or not every frame. This input information is also stored locally for client side replay. The server does not currently keep a list of unprocessed inputs and will always processes the latest input data on the next frame.

This means that what and when input is processed on the server vs client is going to have more difference than if we also processed input per frame on the server.

The symptoms of this can be seen in cases where the client thinks it has collided with the floor or pipe but the server says it didn't happen and then a correction occurs. The reverse can also happen where the client thinks it avoided a collision but the server says otherwise.

Lost inputs can also be seen when a large correction occurs because while the client simulated pressing space, the server didn't get it and so the authoritative position is one where the player kept falling.

[Check out this GDC talk for more on how games like Overwatch handle these issues.](https://www.gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and)

## Getting Started

This project uses [Hathora and requires the hathora cli](https://hathora.dev).

Clone the repository and run:

```
hathora dev
```

Head over to [http://localhost:3001](http://localhost:3001) to see a React app to create a new game or join an existing. Either option will end up loading a Phaser 3 client game.

The Hathora prototype UI will be running on http://localhost:3000.

## License

[MIT License](https://github.com/ourcade/flappy-bird-hathora/blob/master/LICENSE)
