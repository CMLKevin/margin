import {collectionSession} from './reader.ts';
import {jinaKey} from '../server/settings.mjs';
export function serverCollectionSession(){return collectionSession({jinaApiKey:jinaKey()||undefined});}
