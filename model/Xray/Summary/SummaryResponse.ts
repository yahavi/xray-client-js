import { ISummaryError } from './Error';
import { IArtifact } from './Artifact';

export interface ISummaryResponse {
    artifacts: IArtifact[];
    errors: ISummaryError[];
}
