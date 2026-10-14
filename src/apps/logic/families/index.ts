/** Builder 3's families (docs/GEO-LOGIC.md §E.6). */
import type { PuzzleFamily } from '../engine/types';
import { seqNumber } from './seqNumber';
import { numberBox } from './numberBox';
import { ruleMachine } from './ruleMachine';
import { codeBreak } from './codeBreak';
import { balance } from './balance';
import { clockCalendar } from './clockCalendar';
import { miniSudoku } from './miniSudoku';
import { mazePath } from './mazePath';
import { oddOneOut } from './oddOneOut';
import { analogy } from './analogy';

export const numberFamilies: PuzzleFamily[] = [seqNumber, numberBox, ruleMachine, codeBreak, balance, clockCalendar, miniSudoku, mazePath, oddOneOut, analogy];
