// Naming and onboarding are children of the application's v5 save.
// Legacy saves have no tutorial cursor; opening them never restarts onboarding.
export function normalizeNativeOpening(value){
  if(value===undefined||value===null)return null;
  if(value.version!==1||Object.keys(value).some(k=>!['version','trainerName','tutorialStep'].includes(k))
    ||typeof value.trainerName!=='string'||value.trainerName.length<1||value.trainerName.length>5
    ||value.trainerName.trim()!==value.trainerName||/[\p{Cc}\p{Cf}]/u.test(value.trainerName)
    ||(value.tutorialStep!==null&&(!Number.isInteger(value.tutorialStep)||value.tutorialStep< -1||value.tutorialStep>71)))throw new TypeError('INVALID_NATIVE_OPENING_SAVE');
  return Object.freeze({...value});
}
