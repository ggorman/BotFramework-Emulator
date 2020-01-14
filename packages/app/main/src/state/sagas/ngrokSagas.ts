//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
import { takeLatest } from 'redux-saga';
import { select, put } from 'redux-saga/effects';

import {
  NgrokTunnelActions,
  NgrokTunnelAction,
  StatusCheckOnTunnel,
  TunnelCheckTimeInterval,
  setTimeIntervalSinceLastPing,
} from '../actions/ngrokTunnelActions';
import { RootState } from '../store';

const getLastPingedTimestamp = (state: RootState): number => state.ngrokTunnel.lastPingedTimestamp;
const getPublicUrl = (state: RootState): string => state.ngrokTunnel.publicUrl;

const pingTunnel = async (publicUrl: string): Promise<Response | undefined> => {
  const response: Response = await fetch(publicUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const isErrorResponse =
    response.status === 429 || response.status === 402 || response.status === 500 || !response.headers.get('Server');
  if (isErrorResponse) {
    return response;
  }
  return undefined;
};

const getPingTimeInterval = (lastPingTime: number): TunnelCheckTimeInterval => {
  const diff = new Date().getTime() - lastPingTime;

  if (diff < 20000) {
    return TunnelCheckTimeInterval.FirstInterval;
  }
  if (diff >= 60000) {
    return TunnelCheckTimeInterval.Now;
  }
  return TunnelCheckTimeInterval.SecondInterval;
};

export class NgrokSagas {
  public static *runTunnelStatusHealthCheck(action: NgrokTunnelAction<StatusCheckOnTunnel>): IterableIterator<any> {
    const lastPingTimestamp: number = yield select(getLastPingedTimestamp);
    const publicUrl: string = yield select(getPublicUrl);
    const interval: TunnelCheckTimeInterval = getPingTimeInterval(lastPingTimestamp);
    if (action.payload.forceCheckTunnelNow || interval === TunnelCheckTimeInterval.Now) {
      const errorOnReponse = yield pingTunnel(publicUrl);
      if (errorOnReponse) {
        action.payload.onTunnelPingError(errorOnReponse);
      } else {
        action.payload.onTunnelPingSuccess();
      }
      yield put(setTimeIntervalSinceLastPing(TunnelCheckTimeInterval.Now));
      return;
    }
    yield put(setTimeIntervalSinceLastPing(interval));
  }
}

export function* ngrokSagas(): IterableIterator<any> {
  yield takeLatest(NgrokTunnelActions.checkOnTunnel, NgrokSagas.runTunnelStatusHealthCheck);
}
