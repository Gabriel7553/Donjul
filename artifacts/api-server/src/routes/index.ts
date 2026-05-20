import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanFoodRouter from "./scanFood";
import nutritionCoachRouter from "./nutritionCoach";
import parseFoodRouter from "./parseFood";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanFoodRouter);
router.use(nutritionCoachRouter);
router.use(parseFoodRouter);

export default router;
