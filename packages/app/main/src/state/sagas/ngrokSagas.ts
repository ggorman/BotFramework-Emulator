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
import { takeLatest, delay } from 'redux-saga';
import { select, put, call } from 'redux-saga/effects';

import {
  NgrokTunnelActions,
  NgrokTunnelAction,
  StatusCheckOnTunnel,
  TunnelCheckTimeInterval,
  setTimeIntervalSinceLastPing,
} from '../actions/ngrokTunnelActions';
import { RootState } from '../store';

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

export class NgrokSagas {
  public static *runTunnelStatusHealthCheck(action: NgrokTunnelAction<StatusCheckOnTunnel>): IterableIterator<any> {
    const publicUrl: string = yield select(getPublicUrl);
    const errorOnResponse = yield pingTunnel(publicUrl);
    if (errorOnResponse) {
      action.payload.onTunnelPingError(errorOnResponse);
    } else {
      action.payload.onTunnelPingSuccess();
    }
    yield put(setTimeIntervalSinceLastPing(TunnelCheckTimeInterval.Now));
    yield call(delay, 20000);
    yield put(setTimeIntervalSinceLastPing(TunnelCheckTimeInterval.FirstInterval));
    yield call(delay, 20000);
    yield put(setTimeIntervalSinceLastPing(TunnelCheckTimeInterval.SecondInterval));
  }
}

export function* ngrokSagas(): IterableIterator<any> {
  yield takeLatest(NgrokTunnelActions.checkOnTunnel, NgrokSagas.runTunnelStatusHealthCheck);
}
