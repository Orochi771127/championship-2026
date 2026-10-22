// Private compiled QA only. Called at the original async function's successful
// return point, not a wrapper around its Promise or its caller's lifecycle.
import {reportQaCharacterLoad} from '../../src/championship/app/alternateFormQaDiagnostics.js';
export function observePublicRoster(roster){
 try{reportQaCharacterLoad({...roster.getDiagnostics(),qaObservedLoader:'CURRENT_PUBLIC_CHARACTER_ROSTER'});}
 catch(error){
  // The report owner pushes before painting. A painting failure must not change
  // the original loader's result; its retained error report fails the QA guard.
  try{reportQaCharacterLoad({qaObservedLoader:'CURRENT_PUBLIC_CHARACTER_ROSTER',error:'QA_ROSTER_OBSERVER_FAILURE: '+String(error?.message??error)});}catch{}
 }
 return roster;
}
