import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const MAIN_SHA256='b91fdfd3f6b0493b048929fc114ad2ae05c9ba49dabe0ced8b6a594b5b804e66';
export function injectClockReset(bytes){
 assert.equal(createHash('sha256').update(bytes).digest('hex'),MAIN_SHA256,'Exact public main source required');
 const source=bytes.toString('utf8'),needle='let clockDriver = null;';
 assert.equal(source.split(needle).length,2);
 return source.replace(needle,needle+`
// TEST ONLY: preserve production elapsed adapter; exclude diagnostic pause time.
if (!['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw Error('TEST_CLOCK_LOOPBACK_ONLY');
globalThis.__pointHeightClock = Object.freeze({
  resetElapsedBaseline() {
    if (!clockDriver) throw Error('EXISTING_CLOCK_DRIVER_REQUIRED');
    clockDriver.reset();
    return {kind:'EXISTING_CLOCK_DRIVER_RESET_ONLY'};
  }
});`);
}
