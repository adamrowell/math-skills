/** Builder 4's visual puzzle families (docs/GEO-LOGIC.md §E.6). */
import type { PuzzleFamily } from '../../engine/types';
import { countFigures } from './countFigures';
import { growingPattern } from './growing';
import { matrix } from './matrix';
import { mirror } from './mirror';
import { rotation } from './rotation';
import { paperFold } from './paperFold';
import { patternBlock } from './patternBlock';
import { seqShape } from './seqShape';
import { symmetryFill } from './symmetry';
import { tangramFit } from './tangram';

export const visualFamilies: PuzzleFamily[] = [seqShape, growingPattern, matrix, mirror, rotation, symmetryFill, paperFold, countFigures, patternBlock, tangramFit];
