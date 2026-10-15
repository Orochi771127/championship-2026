// Observe the normal completed-character loader without replacing any result.
import {loadCompletedOriginalCharacters as loadReal} from '../presentation/completedOriginalCharacters.js?alternate-form-qa-real';
import {reportQaCharacterLoad} from './alternateFormQaDiagnostics.js';
export * from '../presentation/completedOriginalCharacters.js?alternate-form-qa-real';
export async function loadCompletedOriginalCharacters(...args){
 try{const roster=await loadReal(...args);reportQaCharacterLoad({side:args[0]?.side??null,...roster.getDiagnostics()});return roster;}
 catch(error){reportQaCharacterLoad({side:args[0]?.side??null,error:String(error.message)});throw error;}
}
