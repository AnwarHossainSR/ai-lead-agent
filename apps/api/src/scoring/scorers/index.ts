import { registerScorer } from "../scorer";
import { businessFitScorer } from "./business-fit.scorer";
import { contactReachabilityScorer } from "./contact-reachability.scorer";
import { opportunityStrengthScorer } from "./opportunity-strength.scorer";
import { technologyFitScorer } from "./technology-fit.scorer";
import { websiteQualityScorer } from "./website-quality.scorer";

registerScorer(websiteQualityScorer);
registerScorer(technologyFitScorer);
registerScorer(opportunityStrengthScorer);
registerScorer(contactReachabilityScorer);
registerScorer(businessFitScorer);
