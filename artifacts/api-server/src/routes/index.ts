import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanFoodRouter from "./scanFood";
import nutritionCoachRouter from "./nutritionCoach";
import parseFoodRouter from "./parseFood";
import weeklyReviewRouter from "./weeklyReview";
import syncRouter from "./sync";
import stateRouter from "./state";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanFoodRouter);
router.use(nutritionCoachRouter);
router.use(parseFoodRouter);
router.use(weeklyReviewRouter);
router.use(syncRouter);
router.use(stateRouter);

export default router;
