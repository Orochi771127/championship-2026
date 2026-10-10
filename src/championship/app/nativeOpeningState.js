// Naming and onboarding are children of the application's v5 save.
// V1/legacy cursors retain their exact meaning. Only explicit new-game runtime
// entry creates V2; loading an old save never opts it into interactive teaching.
import {normalizeInteractiveTutorialCheckpoint} from "./interactiveTutorialCheckpoint.js";

export function normalizeNativeOpening(value){
  if(value===undefined||value===null)return null;
  if(typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError('INVALID_NATIVE_OPENING_SAVE');
  const v2=value.version===2;
  const keys=v2?['version','trainerName','tutorialStep','checkpoint']:['version','trainerName','tutorialStep'];
  if((!v2&&value.version!==1)||Reflect.ownKeys(value).length!==keys.length
    ||Reflect.ownKeys(value).some(k=>!keys.includes(k))
    ||typeof value.trainerName!=='string'||value.trainerName.length<1||value.trainerName.length>5
    ||value.trainerName.trim()!==value.trainerName||/[\p{Cc}\p{Cf}]/u.test(value.trainerName)
    ||(value.tutorialStep!==null&&(!Number.isInteger(value.tutorialStep)||value.tutorialStep< -1||value.tutorialStep>71))
    ||(v2&&value.tutorialStep!==null))throw new TypeError('INVALID_NATIVE_OPENING_SAVE');
  return Object.freeze({...value,...(v2?{checkpoint:normalizeInteractiveTutorialCheckpoint(value.checkpoint)}:{})});
}
