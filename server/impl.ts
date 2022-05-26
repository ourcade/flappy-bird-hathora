import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import {
  Location,
  Input,
  Player,
  GameState,
  UserId,
  IInitializeRequest,
  IJoinGameRequest,
  IFlapRequest,
} from "../api/types";

type InternalState = GameState;

export class Impl implements Methods<InternalState> {
  initialize(ctx: Context, request: IInitializeRequest): InternalState {
    return {
      players: [],
    };
  }
  joinGame(state: InternalState, userId: UserId, ctx: Context, request: IJoinGameRequest): Response {
    return Response.error("Not implemented");
  }
  flap(state: InternalState, userId: UserId, ctx: Context, request: IFlapRequest): Response {
    return Response.error("Not implemented");
  }
  getUserState(state: InternalState, userId: UserId): GameState {
    return state;
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): void {}
}
